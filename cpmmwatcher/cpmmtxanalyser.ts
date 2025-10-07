import Client from "@triton-one/yellowstone-grpc";
import { Connection, PublicKey } from "@solana/web3.js";
import net from "net"; // Import Node.js's built-in TCP module

// Keep your helper function, it's correct
async function resolveAllAccountKeys(message: any, connection: Connection): Promise<PublicKey[]> {
    // ... (Your resolveAllAccountKeys function remains unchanged, but pass connection as an argument)
    // ... I've added the connection parameter for clarity
    const staticKeys = message.accountKeys.map((buf: Buffer) => new PublicKey(buf));
    const lookupTableAccounts = [];

    if (message.addressTableLookups) {
        for (const lookup of message.addressTableLookups) {
            const lookupTableAddress = new PublicKey(lookup.accountKey);
            const table = await connection.getAddressLookupTable(lookupTableAddress);
            if (table.value) {
                lookupTableAccounts.push(table.value);
            }
        }
    }

    const resolvedKeys: PublicKey[] = [];

    if (message.addressTableLookups) {
        for (let i = 0; i < message.addressTableLookups.length; i++) {
            const lookup = message.addressTableLookups[i];
            const table = lookupTableAccounts[i];
            if (!table) continue;

            for (const index of lookup.writableIndexes) {
                if (index < table.state.addresses.length) {
                    resolvedKeys.push(table.state.addresses[index]);
                }
            }
            for (const index of lookup.readonlyIndexes) {
                if (index < table.state.addresses.length) {
                    resolvedKeys.push(table.state.addresses[index]);
                }
            }
        }
    }

    return [...staticKeys, ...resolvedKeys];
}


/**
 * =================================================================================
 * The AMM Monitor
 * ---------------------------------------------------------------------------------
 * This object manages the state and lifecycle of the gRPC subscription.
 * =================================================================================
 */
const AmmMonitor = {
    // --- State Variables ---
    state: {
        client: null as Client | null,
        connection: null as Connection | null,
        activeSubscription: null as any | null, // Stores the active gRPC stream
        reportingIntervalId: null as NodeJS.Timeout | null,
        targetAmmPublicKeys: [] as PublicKey[],
        ammTransactionCounts: new Map<string, number>(),
        lastAmmResults: new Map<string, number>(),
        timeframeSeconds: 30,
    },

    /**
     * Initializes the monitor with required clients and settings.
     */
    initialize(grpcUrl: string, grpcToken: string | undefined, rpcUrl: string, timeframe: number) {
        this.state.client = new Client(grpcUrl, grpcToken, undefined);
        this.state.connection = new Connection(rpcUrl, "confirmed");
        this.state.timeframeSeconds = timeframe;
        console.log("AMM Monitor initialized.");
    },

    /**
     * Stops the current subscription and reporting, and clears all data.
     */
    stop() {
        console.log("Stopping current monitoring subscription...");
        if (this.state.activeSubscription) {
            this.state.activeSubscription.destroy(); // Close the gRPC stream
            this.state.activeSubscription = null;
        }
        if (this.state.reportingIntervalId) {
            clearInterval(this.state.reportingIntervalId);
            this.state.reportingIntervalId = null;
        }
        this.state.targetAmmPublicKeys = [];
        this.state.ammTransactionCounts.clear();
        this.state.lastAmmResults.clear();
        console.log("Monitoring stopped and state cleared.");
    },

    /**
     * Starts monitoring a new list of AMM addresses.
     */
    async start(ammAddresses: string[]) {
        if (!this.state.client || !this.state.connection) {
            console.error("Monitor not initialized. Call AmmMonitor.initialize() first.");
            return;
        }
        if (ammAddresses.length === 0) {
            console.log("Received an empty list of AMMs. Monitoring will remain idle.");
            return;
        }

        console.log(`Starting to monitor ${ammAddresses.length} AMMs:`, ammAddresses);

        // Setup state for the new subscription
        this.state.targetAmmPublicKeys = ammAddresses.map((addr) => new PublicKey(addr));
        this.state.targetAmmPublicKeys.forEach(pk => this.state.lastAmmResults.set(pk.toBase58(), 0));

        try {
            this.state.activeSubscription = await this.state.client.subscribe();
        } catch (error) {
            console.error("Failed to create new gRPC subscription:", error);
            return;
        }

        // --- Send Subscription Request ---
        this.state.activeSubscription.write({
            slots: {},
            accounts: {
            },
            transactions: {
              accountActivity: {
                vote: false,
                failed: false,
                signature: undefined,
                accountInclude: ammAddresses,  // your string[]
                accountExclude: [],
                accountRequired: []
              }
            },
            transactionsStatus: {},
            blocks: {},
            blocksMeta: {},
            accountsDataSlice: [],
            entry: {},
            commitment: 1
          }, (err: Error) => {
            if (err) {
              console.error("Error sending subscription request:", err);
              // Handle the error, perhaps close the connection or retry
            } else {
              console.log("Subscription request sent with accountInclude filter.");
            }
        });

        // --- Data Handling Logic ---
        this.state.activeSubscription.on("data", async (data: any) => {
            if (data.transaction) {
                try {
                    const accountKeys = await resolveAllAccountKeys(data.transaction.transaction.transaction.message, this.state.connection!);
                    for (const txAccountKey of accountKeys) {
                        for (const targetAmmPk of this.state.targetAmmPublicKeys) {
                            if (txAccountKey.equals(targetAmmPk)) {
                                const ammAddress = targetAmmPk.toBase58();
                                this.state.ammTransactionCounts.set(ammAddress, (this.state.ammTransactionCounts.get(ammAddress) || 0) + 1);
                            }
                        }
                    }
                } catch (error) {
                     // console.error("Error processing transaction data:", error); // Can be noisy
                }
            }
        });

        this.state.activeSubscription.on("error", (error: any) => {
            console.error("Yellowstone gRPC stream error:", error);
            // Consider adding reconnection logic here or in the 'end' event
        });

        this.state.activeSubscription.on("end", () => {
            console.log("Yellowstone gRPC stream ended. The subscription might need to be restarted.");
            this.stop(); // Clean up state after the stream ends
        });

        // --- Start Reporting Interval ---
        this.state.reportingIntervalId = setInterval(() => {
            this.generateReport();
        }, this.state.timeframeSeconds * 1000);
    },

    /**
     * Main function to update the list of AMMs to monitor. It stops the old
     * subscription and starts a new one.
     */
    updateAndResubscribe(newAmmAddresses: string[]) {
        this.stop();
        this.start(newAmmAddresses);
    },

    /**
     * The periodic reporting logic, extracted into its own function.
     */
    generateReport() {
        console.log(`\n--- Transaction Report for last ${this.state.timeframeSeconds} seconds ---`);
        if (this.state.targetAmmPublicKeys.length === 0) {
            console.log("No AMMs are currently being monitored.");
            console.log("----------------------------------------------------");
            return;
        }

        const consecutiveAmmsWithDetails: { ammAddress: string; currentTxCount: number; previousTxCount: number; percentageOfPrevious: number }[] = [];

        // Identify consecutive AMMs based on the 30% threshold
        this.state.targetAmmPublicKeys.forEach(pk => {
          const ammAddress = pk.toBase58();
          const currentCount = this.state.ammTransactionCounts.get(ammAddress) || 0;
          const previousCount = this.state.lastAmmResults.get(ammAddress) || 0; // Will be 0 if not active before
    
          if (previousCount > 0) { // Only check percentage if there was activity in the previous timeframe
            const percentage = (currentCount / previousCount) * 100;
            if (percentage >= 30 && previousCount > 15) {
              consecutiveAmmsWithDetails.push({
                ammAddress,
                currentTxCount: currentCount,
                previousTxCount: previousCount,
                percentageOfPrevious: percentage
              });
            }
          }
        });
    
        if (consecutiveAmmsWithDetails.length > 0) {
          console.log("\nConsecutive AMMs (current TX count >= 30% of previous TX count):");
          consecutiveAmmsWithDetails.forEach(amm => {
            console.log(`  - AMM: ${amm.ammAddress}, Current Tx: ${amm.currentTxCount}, Previous Tx: ${amm.previousTxCount}, Percentage: ${amm.percentageOfPrevious.toFixed(2)}%`);
          });
          // Here you would send `consecutiveAmmsWithDetails` to your other script via TCP/WebSocket
          // or perform any other action.
        } else {
          console.log("\nNo consecutively active AMMs (meeting 30% threshold) found in this timeframe.");
        }
        
        // Report logic is the same as your original script, just using the state object
        // ... (The rest of your reporting logic goes here) ...

        // Save the current counts for the next comparison
        this.state.targetAmmPublicKeys.forEach(pk => {
            const ammAddress = pk.toBase58();
            this.state.lastAmmResults.set(ammAddress, this.state.ammTransactionCounts.get(ammAddress) || 0);
        });

        // Reset counts for the next timeframe
        this.state.ammTransactionCounts.clear();

        console.log("----------------------------------------------------");
    }
};

/**
 * =================================================================================
 * The TCP Server
 * ---------------------------------------------------------------------------------
 * Listens for incoming connections and updates the AMM Monitor.
 * =================================================================================
 */
function startTcpServer(port: number) {
    const server = net.createServer((socket) => {
        console.log(`[TCP Server] Client connected from ${socket.remoteAddress}:${socket.remotePort}`);
        let buffer = '';

        socket.on('data', (data) => {
            buffer += data.toString();
            // Assuming the full list is sent in one go, followed by connection close.
            // Or that messages are separated by a specific delimiter you control.
            // For simplicity, we'll process on 'end'.
        });

        socket.on('end', () => {
            console.log("[TCP Server] Client disconnected.");
            // Parse the received data into an array of addresses.
            // We split by newline and filter out any empty lines or whitespace.
            const newAmmAddresses = buffer
                .split(/\r?\n/)
                .map(line => line.trim())
                .filter(line => line.length > 0);

                if (newAmmAddresses.length > 0) {
                    console.log(`[TCP Server] Received ${newAmmAddresses.length} new AMM addresses.`);
                
                    // Merge old and new (removing duplicates)
                    const mergedAddresses = [
                        ...new Set([
                            ...AmmMonitor.state.targetAmmPublicKeys.map(pk => pk.toBase58()),
                            ...newAmmAddresses
                        ])
                    ];
                
                    console.log(`[TCP Server] Now monitoring ${mergedAddresses.length} total AMM addresses.`);
                    AmmMonitor.updateAndResubscribe(mergedAddresses);
                } else {
                    console.log("[TCP Server] Received empty list. No changes made.");
                }
        });

        socket.on('error', (err) => {
            console.error('[TCP Server] Socket error:', err);
        });
    });

    server.listen(port, () => {
        console.log(`✅ TCP server listening on port ${port}`);
        console.log("Send a newline-separated list of AMM addresses to this port to start monitoring.");
        console.log("Example using netcat: `cat my_amms.txt | nc localhost 8080`");
    });
}

/**
 * =================================================================================
 * Main Execution
 * =================================================================================
 */

// --- Configuration ---
const GRPC_URL = "http://127.0.0.1:10000"; // Your Yellowstone gRPC URL
const GRPC_TOKEN = " ";   // Optional: Your gRPC auth token
const RPC_URL = "http://127.0.0.1:8899";    // Your Solana RPC URL for fetching lookup tables
const TIMEFRAME_SECONDS = 30;              // Report every 30 seconds
const TCP_PORT = 55123;                     // Port for the TCP server to listen on

// --- Start the application ---
AmmMonitor.initialize(GRPC_URL, GRPC_TOKEN, RPC_URL, TIMEFRAME_SECONDS);
startTcpServer(TCP_PORT);