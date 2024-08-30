self.onmessage = function (event) {
    const { chunkX, chunkZ, scale, chunkSize } = event.data;

    // Simulate different chunk data based on chunk coordinates
    const chunkData = [];
    for (let x = 0; x < chunkSize; x++) {
        for (let z = 0; z < chunkSize; z++) {
            const blockTypeCode = (x + z) % 12; // Mock some block types
            chunkData.push({ localX: x, localZ: z, height: 0, blockTypeCode });
        }
    }

    self.postMessage({ chunkX, chunkZ, chunkStartX: chunkX * chunkSize, chunkStartZ: chunkZ * chunkSize, chunkData, scale });
};

