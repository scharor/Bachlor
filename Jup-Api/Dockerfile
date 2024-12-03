# Use a Debian-based image for running the jupiter-swap-api
FROM debian:bookworm-slim

# Set environment variables
ENV RUST_LOG=info 
ENV RPC_URL=http://127.0.0.1:8899
ENV GRPC_ENDPOINT=http://127.0.0.1:10000
ENV X_TOKEN=1

# Copy the jupiter-swap-api binary into the container

COPY jupiter-swap-api /usr/local/bin/your_binary

# Install necessary dependencies
RUN apt-get update && apt-get install unzip openssl ca-certificates -y

# Set the working directory
WORKDIR /usr/local/bin

# Expose port 8080
EXPOSE 8080

# CMD instruction with the jupiter-swap-api command including the addresses file
CMD ["sh", "-c", "./your_binary --market-mode europa --rpc-url $RPC_URL --yellowstone-grpc-endpoint $GRPC_ENDPOINT --yellowstone-grpc-x-token $X_TOKEN --allow-circular-arbitrage  --enable-external-amm-loading --enable-new-dexes --enable-add-market  --filter-markets-with-mints $(cat /usr/local/bin/mints.txt)"]