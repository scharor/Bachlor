import Redis from "ioredis";
import net from "net"; // Import Node.js's built-in TCP module

async function fetchDataAndRank() {
  const redis = new Redis({ host: "localhost", port: 6379 }); // Verbinde dich mit der KeyDB-Instanz

  // Variable, um die Mints mit einer Metrik >= 20 des vorherigen Durchlaufs zu speichern
  let previousHighMetricMints: string[] = [];
  let previousHighMetricPools: string[] = [];

  try {
    // Hilfsfunktion, um alle Daten von Redis abzurufen
    async function getAllPoolData(): Promise<{ [poolId: string]: any }> {
      const poolData: { [poolId: string]: any } = {};
      const keys = await redis.keys("*"); // Rufe alle Schlüssel ab
      for (const key of keys) {
        const type = await redis.type(key);
        if (type === "hash") {
          const data = await redis.hgetall(key);
          if (data) {
            poolData[key] = data;
          }
        } else {
          console.warn(`Schlüssel "${key}" ist kein Hash, überspringe ihn.`);
        }
      }
      return poolData;
    }

    // NEUE FUNKTION: Sendet Daten über eine TCP-Verbindung an dein anderes Skript
    async function sendDataViaTcp(mints: string[]) {
      const TCP_PORT = 55123; // Der Port deines TCP-Servers aus dem anderen Skript
      const TCP_HOST = 'localhost';

      if (mints.length === 0) {
        return; // Nichts zu senden
      }

      // Wir verwenden ein Promise, damit wir auf den Abschluss warten können
      return new Promise<void>((resolve, reject) => {
        const client = new net.Socket();
        
        // Wandle das Array in einen einzelnen String um, wobei jede Adresse in einer neuen Zeile steht
        const dataToSend = mints.join('\n');

        client.connect(TCP_PORT, TCP_HOST, () => {
          console.log(`TCP-Verbindung zu ${TCP_HOST}:${TCP_PORT} hergestellt.`);
          client.write(dataToSend);
          client.end(); // Wichtig: Schließe die Verbindung nach dem Senden der Daten
        });

        client.on('close', () => {
          console.log(`Daten über TCP gesendet und Verbindung geschlossen.`);
          resolve(); // Das Promise erfolgreich abschließen
        });

        client.on('error', (error) => {
          console.error('TCP-Client-Fehler:', error.message);
          reject(error); // Das Promise bei einem Fehler ablehnen
        });
      });
    }


    // Funktion zur Berechnung der Metrik und des Rankings
    async function calculateAndRank(
      snapshot1: { [poolId: string]: any },
      snapshot2: { [poolId: string]: any }
    ) {
      const changes: { notSolmint: string; metric: number; valid: boolean; poolid: string }[] = [];
      for (const poolId in snapshot1) {
        if (snapshot1.hasOwnProperty(poolId) && snapshot2.hasOwnProperty(poolId)) {
          const vaultA1 = Number(snapshot1[poolId]?.vaultA);
          const vaultA2 = Number(snapshot2[poolId]?.vaultA);
          const price1 = Number(snapshot1[poolId]?.price);
          const price2 = Number(snapshot2[poolId]?.price);
          const notSolmint = snapshot1[poolId]?.NotSolmint;

          if (!isNaN(vaultA1) && !isNaN(vaultA2) && !isNaN(price1) && !isNaN(price2) && notSolmint) {
            const vaultAChange = vaultA2 - vaultA1;
            let priceChangePercent =
              price1 === 0
                ? price2 === 0
                  ? 0
                  : Infinity
                : ((price2 - price1) / price1) * 100;

            if (priceChangePercent > 100) {
              priceChangePercent = 100;
            }

            const metric = Math.abs(vaultAChange * priceChangePercent);

            const vaultAPercentChange = vaultA1 === 0 ? (vaultA2 === 0 ? 0 : Infinity) : Math.abs(vaultAChange / vaultA1) * 100;
            const isValid = priceChangePercent >= -70 && vaultAPercentChange <= 70;

            if(isValid == false && vaultAChange > 2){
                console.log("alert we have a big mover "+ "solchange"+vaultAChange+"solpercentchange"+vaultAPercentChange);
                console.log(notSolmint+"mint")
            }
            changes.push({ notSolmint, metric, valid: isValid , poolid: poolId});
          }
        }
      }

      const validChanges = changes.filter((change) => change.valid);
      validChanges.sort((a, b) => b.metric - a.metric);

      console.log("Top 20 gerankte NotSolmint nach berechneter Metrik (gefiltert):");
      const top20 = validChanges.slice(0, 20);
      const currentHighMetricMints = validChanges
        .filter(item => item.metric >= 20)
        .map(item => item.notSolmint);

     const currentHighMetricPools = validChanges
     .filter(item => item.metric >= 20)
     .map(item => item.poolid); 

      if (top20.length === 0) {
        console.log("Keine gültigen Daten zum Anzeigen.");
      } else {
        top20.forEach((item, index) => {
          console.log(
            `${index + 1}. NotSolmint: ${item.notSolmint}, Metrik: ${item.metric.toFixed(2)}`
          );
        });
      }

      const consecutiveHighMetricMints: string[] = [];
      const consecutiveHighMetricPools: string[] = [];
      currentHighMetricMints.forEach(mint => {
        if (previousHighMetricMints.includes(mint)) {
          consecutiveHighMetricMints.push(mint);
        }
      });

      currentHighMetricPools.forEach(Pool => {
        if (previousHighMetricPools.includes(Pool)) {
          consecutiveHighMetricPools.push(Pool);
        }
      });

      if (consecutiveHighMetricMints.length > 0) {
        console.log("\nMints, die 2x hintereinander eine Metrik >= 20 haben:", consecutiveHighMetricMints);
        console.log("\nMints, die 2x hintereinander eine Metrik >= 20 haben:Pool", consecutiveHighMetricPools);
        // Sende die Daten über TCP statt WebSocket
        await sendDataViaTcp(consecutiveHighMetricPools);
      } else {
        console.log("\nKeine Mints 2x hintereinander mit Metrik >= 20 gefunden.");
      }

      previousHighMetricMints = currentHighMetricMints;
      previousHighMetricPools = currentHighMetricPools;
    }

    // Führe die Analyse in einer Schleife aus
    while (true) {
      const snapshot1 = await getAllPoolData();
      await new Promise((resolve) => setTimeout(resolve, 30000));
      const snapshot2 = await getAllPoolData();
      await calculateAndRank(snapshot1, snapshot2);
      console.log("--------------------------------------------------");
    }
  } catch (error) {
    console.error("Fehler:", error);
  } finally {
    await redis.quit();
  }
}

fetchDataAndRank();