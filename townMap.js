document.addEventListener("DOMContentLoaded", function () {
    const canvas = document.getElementById('landscapeMap');
    const ctx = canvas.getContext('2d');

    // Sample data for towns
    const towns = [
        { name: "Gravek", x: 10923, z: 13701 },
        { name: "CalvinTown", x: 6857.5, z: 5403.5 },
        { name: "Polandland", x: 107373, z: 88683 },
        { name: "Tealand", x: 35069, z: 1159 },
        { name: "New Nameful", x: 8400, z: 7143 },
        { name: "Kaztopia", x: 33500, z: 43000 },
        { name: "Babylon", x: 7300, z: 6700 },
        { name: "Breeze Town", x: 55713, z: 34557 },
        { name: "Grestin", x: -42383, z: -215239 },
        { name: "SlushyVille", x: 45348, z: -139662 },
        { name: "Gyurtown", x: 7200.5, z: 4260.4 }
    ];

    // Variables for panning and zooming
    let scale = 0.05;  // Adjust the scale to fit your canvas size
    let offsetX = canvas.width / 2;
    let offsetY = canvas.height / 2;
    let isDragging = false;
    let lastX, lastY;

    // Function to draw towns on canvas
    function drawTowns() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw each town
        towns.forEach(town => {
            const x = offsetX + town.x * scale;
            const y = offsetY + town.z * scale; // Correctly map the Z coordinate

            // Draw town as a circle
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = 'red';
            ctx.fill();
            ctx.closePath();

            // Draw town name
            ctx.font = '16px Minecraft';
            ctx.fillStyle = 'black';
            ctx.fillText(town.name, x + 7, y - 7);
        });
    }

    // Mouse events for panning
    canvas.addEventListener('mousedown', function (e) {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
    });

    canvas.addEventListener('mousemove', function (e) {
        if (isDragging) {
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            offsetX += dx;
            offsetY += dy;
            lastX = e.clientX;
            lastY = e.clientY;
            drawTowns();
        }
    });

    canvas.addEventListener('mouseup', function () {
        isDragging = false;
    });

    canvas.addEventListener('mouseout', function () {
        isDragging = false;
    });

    // Mouse wheel event for zooming
    canvas.addEventListener('wheel', function (e) {
        e.preventDefault();
        const zoomFactor = 1.1;
        if (e.deltaY < 0) {
            scale *= zoomFactor;  // Zoom in
        } else {
            scale /= zoomFactor;  // Zoom out
        }
        drawTowns();
    });

    // Initial draw
    drawTowns();
});

