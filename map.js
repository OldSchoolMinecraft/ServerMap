let gl, canvas, program;
let positionBuffer, colorBuffer;
let vertices = [], colors = [];
let chunkSize = 1280; // Adjust to match your actual chunk size
let loadedChunks = new Set();
let loadingQueue = [];
let maxConcurrentLoads = 3; // Maximum number of chunks to load concurrently
let loadTimeout = 200; // Timeout between loading chunks in milliseconds
let offsetX = 0, offsetY = 0, scale = 1;

// Shader sources
const vertexShaderSource = `
    attribute vec4 a_position;
    uniform vec2 u_translation;
    uniform vec2 u_scale;
    void main() {
        vec2 scaledPosition = a_position.xy * u_scale;
        vec2 translatedPosition = scaledPosition + u_translation;
        gl_Position = vec4(translatedPosition, 0.0, 1.0);
    }
`;

const fragmentShaderSource = `
    precision mediump float;
    uniform vec4 u_color;
    void main() {
        gl_FragColor = u_color;
    }
`;

// Initialize WebGL
function initWebGL() {
    canvas = document.getElementById('landscapeMap');
    gl = canvas.getContext('webgl');
    if (!gl) {
        alert('WebGL not supported');
        return;
    }
    program = createShaderProgram();
    if (!program) {
        console.error('Failed to create shader program');
        return;
    }
    gl.useProgram(program);

    positionBuffer = gl.createBuffer();
    colorBuffer = gl.createBuffer();

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Set up WebGL state
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    document.addEventListener('resize', onResize);
    onResize();
    setupEventListeners();
    start();
}

// Create and compile shaders
function createShaderProgram() {
    const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);

    if (!vertexShader || !fragmentShader) return null;

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(shaderProgram));
        return null;
    }

    return shaderProgram;
}

// Compile shader
function compileShader(source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

// Set up buffers and attributes
function setupBuffers() {
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const translationLocation = gl.getUniformLocation(program, 'u_translation');
    const scaleLocation = gl.getUniformLocation(program, 'u_scale');
    const colorUniformLocation = gl.getUniformLocation(program, 'u_color');

    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    gl.uniform2f(translationLocation, offsetX, offsetY);
    gl.uniform2f(scaleLocation, scale, scale);
    gl.uniform4f(colorUniformLocation, 1.0, 1.0, 1.0, 1.0);
}

// Draw map
function drawMap() {
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (vertices.length === 0) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertices.length / 2);
}

// Calculate viewport boundaries in world coordinates
function getViewportBounds() {
    const canvasRect = canvas.getBoundingClientRect();
    const width = canvas.width / scale;
    const height = canvas.height / scale;

    const minX = (offsetX - canvasRect.left) / canvas.width * 2 - 1;
    const maxX = minX + width;
    const minY = (offsetY - canvasRect.top) / canvas.height * 2 - 1;
    const maxY = minY + height;

    return { minX, maxX, minY, maxY };
}

// Calculate chunk coordinates from world coordinates
function worldToChunkCoords(x, y) {
    return {
        chunkX: Math.floor(x / chunkSize),
        chunkZ: Math.floor(y / chunkSize)
    };
}

// Load and render chunks within the viewport
async function loadVisibleChunks() {
    const bounds = getViewportBounds();
    const { minX, maxX, minY, maxY } = bounds;

    const startX = Math.floor(minX / chunkSize);
    const endX = Math.ceil(maxX / chunkSize);
    const startZ = Math.floor(minY / chunkSize);
    const endZ = Math.ceil(maxY / chunkSize);

    console.log(`Viewport bounds: ${minX}, ${maxX}, ${minY}, ${maxY}`);
    console.log(`Chunk range: X(${startX} to ${endX}), Z(${startZ} to ${endZ})`);

    for (let x = startX; x <= endX; x++) {
        for (let z = startZ; z <= endZ; z++) {
            const key = `${x},${z}`;
            if (!loadedChunks.has(key)) {
                console.log(`New chunk detected: ${key}`);  // Log added
                queueChunk(x, z);
            }
        }
    }
}

// Start the map loading and rendering
function queueChunk(x, z) {
    const key = `${x},${z}`;
    if (!loadedChunks.has(key)) {
        loadingQueue.push({ x, z });
        loadedChunks.add(key);
        console.log(`Queued chunk: ${key}`);  // Log added
    } else {
        console.log(`Chunk ${key} already loaded`);  // Log added
    }
}

async function start() {
    setInterval(async () => {
        console.log('Checking queue...');
        await loadVisibleChunks();

        console.log(`Queue length before processing: ${loadingQueue.length}`);  // Log added
        if (loadingQueue.length > 0 && loadingQueue.length <= maxConcurrentLoads) {
            const chunk = loadingQueue.shift();
            console.log(`Loading chunk: ${chunk.x}, ${chunk.z}`);
            await loadChunk(chunk.x, chunk.z);
        }
        console.log(`Queue length after processing: ${loadingQueue.length}`);  // Log added
    }, loadTimeout);
}

// Load chunk data
async function loadChunk(chunkX, chunkZ) {
    try {
        console.log(`Fetching chunk ${chunkX}, ${chunkZ}`);
        const response = await fetch(`chunks/chunk.${chunkX}.${chunkZ}.dat`);
        if (!response.ok) {
            console.warn(`Failed to load chunk ${chunkX}, ${chunkZ}: ${response.statusText}`);
            return;
        }
        const buffer = await response.arrayBuffer();
        const dataView = new DataView(buffer);

        // Check chunk size
        if (buffer.byteLength < chunkSize) {
            console.warn(`Data size too small for chunk ${chunkX}, ${chunkZ}. Expected at least ${chunkSize}, got ${buffer.byteLength}`);
            return;
        }

        console.log(`Loaded chunk ${chunkX}, ${chunkZ}, size: ${buffer.byteLength}`);
        
        let offset = 0;
        const startX = dataView.getInt32(offset, true);
        offset += 4;
        const startZ = dataView.getInt32(offset, true);
        offset += 4;

        if (startX !== chunkX * chunkSize || startZ !== chunkZ * chunkSize) {
            console.warn(`Chunk coordinates do not match: ${chunkX}, ${chunkZ}. Expected (${chunkX * chunkSize}, ${chunkZ * chunkSize}), got (${startX}, ${startZ})`);
            return;
        }

        // Parse chunk data
        const newVertices = [];
        const newColors = [];

        while (offset < buffer.byteLength) {
            const height = dataView.getUint8(offset, true);
            const blockTypeCode = dataView.getInt32(offset + 1, true);
            offset += 5;

            const x = (startX + (offset / chunkSize) % chunkSize) / canvas.width * 2 - 1;
            const y = height / canvas.height * 2 - 1;
            newVertices.push(x, y);

            // Set color based on block type (for demo purposes, use a single color)
            newColors.push(1.0, 1.0, 1.0, 1.0);
        }

        console.log(`Chunk ${chunkX}, ${chunkZ} loaded with ${newVertices.length / 2} vertices`);
        vertices.push(...newVertices);
        colors.push(...newColors);

        drawMap();
    } catch (error) {
        console.error(`Failed to load chunk ${chunkX}, ${chunkZ}:`, error);
    }
}

// Handle resizing and panning
function onResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    drawMap(); // Redraw map after resizing
}

// Handle mouse events for panning
function setupEventListeners() {
    let isDragging = false;
    let startX, startY;

    canvas.addEventListener('mousedown', (event) => {
        isDragging = true;
        startX = event.clientX;
        startY = event.clientY;
    });

    canvas.addEventListener('mousemove', (event) => {
        if (isDragging) {
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;
            offsetX -= dx / scale;
            offsetY -= dy / scale;
            startX = event.clientX;
            startY = event.clientY;
            drawMap();
        }
    });

    canvas.addEventListener('mouseup', () => {
        isDragging = false;
    });

    canvas.addEventListener('wheel', (event) => {
        const scaleFactor = 1.1;
        scale *= (event.deltaY < 0) ? scaleFactor : (1 / scaleFactor);
        drawMap();
    });
}

// Initialize everything
document.addEventListener('DOMContentLoaded', () => {
    initWebGL();
    setupEventListeners();
    start(); // Start loading and rendering chunks
});

