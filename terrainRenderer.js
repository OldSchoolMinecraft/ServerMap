document.addEventListener("DOMContentLoaded", function () {
    const canvas = document.getElementById('landscapeMap');
    const ctx = canvas.getContext('2d');
    const scaleFactor = 1.1; // Zoom factor for each wheel scroll
    const CHUNK_SIZE = 16; // Chunk size in blocks
    const VISIBLE_RANGE = 5; // Number of chunks to load around the player's current position
    const loadedChunks = new Set(); // Keep track of loaded chunks

    let scale = 5; // Initial scale to adjust the map size
    let offsetX = 0; // X-axis panning offset
    let offsetY = 0; // Y-axis panning offset
    let isDragging = false; // To check if the user is dragging the mouse
    let dragStartX = 0; // Start X position of drag
    let dragStartY = 0; // Start Y position of drag

    // Player's position or center of the visible area
    let playerX = 0;
    let playerZ = 0;

    // Function to load a single chunk asynchronously
    async function loadChunk(chunkX, chunkZ) {
        const chunkKey = `${chunkX}.${chunkZ}`;
        if (loadedChunks.has(chunkKey)) return; // Skip if chunk is already loaded

        try {
            const response = await fetch(`chunks/chunk.${chunkX}.${chunkZ}.dat`);
            const buffer = await response.arrayBuffer();
            const dataView = new DataView(buffer);

            // Read chunk coordinates
            const chunkStartX = dataView.getInt32(0, true);
            const chunkStartZ = dataView.getInt32(4, true);

            // Read block data and draw asynchronously
            for (let i = 8; i < buffer.byteLength; i += 2) {
                const height = dataView.getUint8(i);       // Read height
                const blockTypeCode = dataView.getUint8(i + 1); // Read block type

                // Calculate coordinates within the chunk
                const blockIndex = (i - 8) / 2;
                const localX = blockIndex % CHUNK_SIZE;
                const localZ = Math.floor(blockIndex / CHUNK_SIZE);

                // Map block type codes to colors
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

                // Draw block on canvas (batched for better performance)
                ctx.fillStyle = color;
                const drawX = (chunkStartX + localX) * scale;
                const drawY = (chunkStartZ + localZ) * scale;
                ctx.fillRect(drawX + offsetX, drawY + offsetY, scale, scale);
            }

            loadedChunks.add(chunkKey); // Mark chunk as loaded
        } catch (error) {
            console.error(`Failed to load chunk ${chunkX}, ${chunkZ}:`, error);
        }
    }

    // Function to dynamically load visible chunks (throttled)
    function loadVisibleChunks() {
        const chunkX = Math.floor(playerX / CHUNK_SIZE);
        const chunkZ = Math.floor(playerZ / CHUNK_SIZE);

        // Load only the chunks within the visible range asynchronously
        for (let dx = -VISIBLE_RANGE; dx <= VISIBLE_RANGE; dx++) {
            for (let dz = -VISIBLE_RANGE; dz <= VISIBLE_RANGE; dz++) {
                loadChunk(chunkX + dx, chunkZ + dz);
            }
        }
    }

    // Throttle loadVisibleChunks to avoid excessive calls
    let loadingTimeout;
    function throttledLoad() {
        clearTimeout(loadingTimeout);
        loadingTimeout = setTimeout(loadVisibleChunks, 100); // Adjust timeout as needed
    }

    // Function to redraw the canvas with the current scale and offset
    function redrawCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save(); // Save the current state
        ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY); // Apply scaling and offset
        loadVisibleChunks(); // Reload the chunks with updated scale and offset
        ctx.restore(); // Restore the previous state
    }

    // Event listeners for panning and zooming
    canvas.addEventListener("wheel", (event) => {
        event.preventDefault();
        const zoomFactor = event.deltaY > 0 ? 1 / scaleFactor : scaleFactor;
        scale *= zoomFactor;

        // Adjust the offset to zoom around the mouse cursor
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        const newOffsetX = offsetX - (mouseX - offsetX) * (zoomFactor - 1);
        const newOffsetY = offsetY - (mouseY - offsetY) * (zoomFactor - 1);

        offsetX = newOffsetX;
        offsetY = newOffsetY;

        redrawCanvas();
    });

    canvas.addEventListener("mousedown", (event) => {
        event.preventDefault();
        isDragging = true;
        dragStartX = event.clientX;
        dragStartY = event.clientY;

        function onMouseMove(moveEvent) {
            if (!isDragging) return;

            const dx = moveEvent.clientX - dragStartX;
            const dy = moveEvent.clientY - dragStartY;
            offsetX += dx / scale;
            offsetY += dy / scale;
            dragStartX = moveEvent.clientX;
            dragStartY = moveEvent.clientY;
            redrawCanvas();
        }

        function onMouseUp() {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    redrawCanvas(); // Initial load
});

