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
    attribute vec2 a_position;
    attribute vec4 a_color;
    varying vec4 v_color;
    uniform vec2 u_translation;
    uniform vec2 u_scale;

    void main() {
        vec2 scaledPosition = a_position * u_scale + u_translation;
        gl_Position = vec4(scaledPosition, 0.0, 1.0);
        v_color = a_color;
    }
`;

const fragmentShaderSource = `
    precision mediump float;
    varying vec4 v_color;

    void main() {
        gl_FragColor = v_color;
    }
`;

// Initialize WebGL
function initWebGL() {
    canvas = document.getElementById('landscapeMap');
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }
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
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    document.addEventListener('resize', onResize);
    onResize();
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
    const colorLocation = gl.getAttribLocation(program, 'a_color');
    const translationLocation = gl.getUniformLocation(program, 'u_translation');
    const scaleLocation = gl.getUniformLocation(program, 'u_scale');

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionLocation);

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(colorLocation);

    // Set default translation and scale
    gl.uniform2f(translationLocation, offsetX, offsetY);
    gl.uniform2f(scaleLocation, scale, scale);
}

function isInFrustum(x, y) {
    // Simple check; adjust based on your frustum logic
    return x >= -1 && x <= 1 && y >= -1 && y <= 1;
}

// Test draw
function testDraw() {
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Define a simple rectangle
    const rectangleVertices = [
        -0.5,  0.5,
        -0.5, -0.5,
         0.5,  0.5,
         0.5, -0.5
    ];

    const rectangleColors = [
        1.0, 0.0, 0.0, 1.0,  // Red
        1.0, 0.0, 0.0, 1.0,  // Red
        1.0, 0.0, 0.0, 1.0,  // Red
        1.0, 0.0, 0.0, 1.0   // Red
    ];

    // Bind position buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rectangleVertices), gl.STATIC_DRAW);
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Bind color buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rectangleColors), gl.STATIC_DRAW);
    const colorLocation = gl.getUniformLocation(program, 'u_color');
    gl.uniform4f(colorLocation, 1.0, 0.0, 0.0, 1.0); // Red color

    // Draw the rectangle
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}


// Draw map
function drawMap() {
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (vertices.length === 0 || colors.length === 0) {
        console.warn('No vertices or colors to draw');
        return;
    }

    // Set up buffers and attributes
    setupBuffers();

    // Bind and set up position buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    // Bind and set up color buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    // Draw the vertices
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2);
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
                loadChunk(x, z);
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

function getBlockColor(blockTypeCode)
{
    switch (blockTypeCode) {
        case 1: return [0.5, 0.5, 0.5, 1.0]; // Gray for Stone
        case 2: return [0.0, 1.0, 0.0, 1.0]; // Green for Grass
        case 3: return [0.6, 0.3, 0.0, 1.0]; // Brown for Dirt
        case 4: return [0.5, 0.5, 0.5, 1.0]; // Gray for Cobblestone
        case 7: return [0.0, 0.0, 0.0, 1.0]; // Black for Bedrock
        case 8: return [0.0, 0.0, 1.0, 1.0]; // Blue for Water
        case 9: return [0.0, 0.0, 1.0, 1.0]; // Blue for Water
        case 10: return [1.0, 0.5, 0.0, 1.0]; // Orange for Lava
        case 11: return [1.0, 0.5, 0.0, 1.0]; // Orange for Lava
        case 12: return [1.0, 1.0, 0.0, 1.0]; // Yellow for Sand
        case 13: return [0.8, 0.8, 0.8, 1.0]; // Light Grey for Water
        case 18: return [0.0, 1.0, 0.0, 1.0]; // Green for Leaves
        case 35: return [1.0, 1.0, 1.0, 1.0]; // White for Water
        default: return [1.0, 0.0, 1.0, 1.0]; // Magenta for Unknown
    }
}

async function loadChunk(loadX, loadZ) {
    console.log(`Fetching chunk ${loadX}, ${loadZ}`);
    const response = await fetch(`chunks/chunk.${loadX}.${loadZ}.dat`);
    if (!response.ok) {
        console.warn(`Failed to load chunk ${loadX}, ${loadZ}: ${response.statusText}`);
        return;
    }
    const arrayBuffer = await response.arrayBuffer();
    const dataView = new DataView(arrayBuffer);

    let offset = 0;
    const chunkX = dataView.getInt32(offset, true); offset += 4;
    const chunkZ = dataView.getInt32(offset, true); offset += 4;

    console.log(`Loaded chunk ${chunkX}, ${chunkZ}, size: ${arrayBuffer.byteLength}`);

    const chunkSize = 16;

//    if (loadX !== chunkX * chunkSize || loadZ !== chunkZ * chunkSize) {
//        console.warn(`Chunk coordinates do not match: ${chunkX}, ${chunkZ}. Expected (${chunkX * chunkSize}, ${chunkZ * chunkSize}), got (${chu}, ${startZ})`);
//        return;
//    }

    // Parse chunk data
    const newVertices = [];
    const newColors = [];
    
    const verticesPerBlock = 6; // Two triangles per block, 3 vertices per triangle
    for (let x = 0; x < chunkSize; x++) {
        for (let z = 0; z < chunkSize; z++) {
            const height = dataView.getUint8(offset); offset += 1;
            const blockType = dataView.getInt32(offset, true); offset += 4;

            // Calculate normalized coordinates
            const x0 = (loadX * chunkSize + x) / canvas.width * 2 - 1;
            const x1 = x0 + (1 / canvas.width) * 2; // Adjust to get a square
            const y0 = height / canvas.height * 2 - 1;
            const y1 = y0 + (1 / canvas.height) * 2; // Adjust to get a square

            // Define vertices for the square (two triangles)
            const blockVertices = [
                x0, y0, 0, // Bottom-left
                x1, y0, 0, // Bottom-right
                x0, y1, 0, // Top-left
                x1, y0, 0, // Bottom-right
                x1, y1, 0, // Top-right
                x0, y1, 0  // Top-left
            ];

            // Push vertices
            newVertices.push(...blockVertices);

            // Get block color and push color values (one color per vertex)
            const color = getBlockColor(blockType);
            const blockColors = [
                ...color, // Bottom-left
                ...color, // Bottom-right
                ...color, // Top-left
                ...color, // Bottom-right
                ...color, // Top-right
                ...color  // Top-left
            ];

            newColors.push(...blockColors);
        }
    }

    console.log(`Chunk ${chunkX}, ${chunkZ} loaded with ${newVertices.length / 2} vertices`);
    vertices.push(...newVertices);
    colors.push(...newColors);

    drawMap();
//    testDraw();
}

// Handle resizing and panning
function onResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
//    drawMap(); // Redraw map after resizing
    testDraw();
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
//            testDraw();
        }
    });

    canvas.addEventListener('mouseup', () => {
        isDragging = false;
    });

    canvas.addEventListener('wheel', (event) => {
        const scaleFactor = 1.1;
        scale *= (event.deltaY < 0) ? scaleFactor : (1 / scaleFactor);
        drawMap();
//        testDraw();
    });
}

// Initialize everything
document.addEventListener('DOMContentLoaded', () => {
    initWebGL();
    setupEventListeners();
});

