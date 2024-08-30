self.onmessage = async function (event) {
    const { chunkX, chunkZ, scale, chunkSize } = event.data;

    try {
        console.log(`Loading chunk ${chunkX}, ${chunkZ}`);

        const response = await fetch(`chunks/chunk.${chunkX}.${chunkZ}.dat`);

        if (!response.ok) {
            console.error(`Failed to fetch chunk ${chunkX}, ${chunkZ}: ${response.statusText}`);
            self.postMessage({ error: `Failed to load chunk ${chunkX}, ${chunkZ}` });
            return;
        }

        const buffer = await response.arrayBuffer();
        const dataView = new DataView(buffer);

        if (buffer.byteLength < 8) {
            console.error(`Chunk ${chunkX}, ${chunkZ} data is too small. Size: ${buffer.byteLength}`);
            self.postMessage({ error: `Data for chunk ${chunkX}, ${chunkZ} is too small.` });
            return;
        }

        const chunkData = [];
        const chunkStartX = dataView.getInt32(0, true); // Little-endian
        const chunkStartZ = dataView.getInt32(4, true); // Little-endian

        console.log(`Chunk ${chunkX}, ${chunkZ} start position: ${chunkStartX}, ${chunkStartZ}`);

        let offset = 8;
        while (offset + 5 <= buffer.byteLength) {
            const height = dataView.getUint8(offset);
            const blockTypeCode = dataView.getUint8(offset + 1); // 1 byte for block type

            const blockIndex = (offset - 8) / 5; // Each block data is 5 bytes (1 byte height + 4 bytes block type code)
            const localX = blockIndex % chunkSize;
            const localZ = Math.floor(blockIndex / chunkSize);

            chunkData.push({ localX, localZ, height, blockTypeCode });

            offset += 5; // Move to the next block data
        }

        console.log(`Processed chunk ${chunkX}, ${chunkZ} with ${chunkData.length} data points.`);
        self.postMessage({ chunkX, chunkZ, chunkStartX, chunkStartZ, chunkData, scale });

    } catch (error) {
        console.error(`Failed to load chunk ${chunkX}, ${chunkZ}:`, error);
        self.postMessage({ error: `Failed to load chunk ${chunkX}, ${chunkZ}` });
    }
};

