document.addEventListener("DOMContentLoaded", function () {
    const canvas = document.getElementById('landscapeMap');
    const ctx = canvas.getContext('2d');
    const scale = 0.5;
    const CHUNK_SIZE = 16; // Minecraft chunk size
    const VISIBLE_RANGE = 5;

    let playerX = 0;
    let playerZ = 0;

    const chunkLoaderWorker = new Worker('chunkLoaderWorker.js');
    const loadedChunks = new Set();

    chunkLoaderWorker.onmessage = function (event) {
        const { chunkX, chunkZ, chunkStartX, chunkStartZ, chunkData, scale, error } = event.data;

        if (error) {
            console.error(`Worker error: ${error}`);
            return;
        }

        if (!chunkData || !Array.isArray(chunkData)) {
            console.error(`Invalid chunk data received for chunk ${chunkX}, ${chunkZ}`);
            return;
        }

        chunkData.forEach(({ localX, localZ, height, blockTypeCode }) => {
            let color;
            switch (blockTypeCode) {
                case 1: color = 'gray'; break;  // Stone
                case 2: color = 'green'; break; // Grass
                case 3: color = 'brown'; break; // Dirt
                case 4: color = 'gray'; break;  // Cobblestone
                case 8: color = 'blue'; break;  // Water
                case 9: color = 'blue'; break;  // Water
                case 10: color = 'orange'; break;  // Lava
                case 11: color = 'orange'; break;  // Lava
                case 12: color = 'yellow'; break; // Sand
                default: color = 'white';        // Unknown
            }

            ctx.fillStyle = color;
            const drawX = (chunkStartX + localX) * scale;
            const drawY = (chunkStartZ + localZ) * scale;
            ctx.fillRect(drawX, drawY, scale, scale);
        });

        loadedChunks.add(`${chunkX}_${chunkZ}`);
    };

    function loadChunk(chunkX, chunkZ) {
        if (!loadedChunks.has(`${chunkX}_${chunkZ}`)) {
            chunkLoaderWorker.postMessage({ chunkX, chunkZ, scale, chunkSize: CHUNK_SIZE });
        }
    }

    function loadVisibleChunks() {
        const chunkX = Math.floor(playerX / CHUNK_SIZE);
        const chunkZ = Math.floor(playerZ / CHUNK_SIZE);

        for (let dx = -VISIBLE_RANGE; dx <= VISIBLE_RANGE; dx++) {
            for (let dz = -VISIBLE_RANGE; dz <= VISIBLE_RANGE; dz++) {
                loadChunk(chunkX + dx, chunkZ + dz);
            }
        }
    }

    let loadingTimeout;
    function throttledLoad() {
        clearTimeout(loadingTimeout);
        loadingTimeout = setTimeout(() => requestAnimationFrame(loadVisibleChunks), 100);
    }

    canvas.addEventListener("wheel", (event) => {
        throttledLoad();
    });

    canvas.addEventListener("mousemove", (event) => {
        const deltaX = event.movementX;
        const deltaY = event.movementY;

        playerX -= deltaX;
        playerZ -= deltaY;

        throttledLoad();
    });

    loadVisibleChunks(); // Initial load
});

