/**
 * Mazer Game - Main Game Logic
 */
class MazerGame {
    constructor() {
        this.canvas = document.getElementById('maze-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // ========== DEBUG: Animated Maze Generation ==========
        // Set to true to watch the maze being created step by step
        // Set to false for instant maze generation (production mode)
        this.ANIMATE_MAZE_GENERATION = true;
        this.mazeAnimationDelay = 15; // milliseconds between steps (lower = faster)
        // =====================================================
        
        // ========== MAZE COMPLEXITY OPTIONS ==========
        // Algorithm: 'huntAndKill' (complex), 'backtrack' (simple corridors), 'kruskal' (branching)
        this.mazeAlgorithm = 'huntAndKill';
        // Braiding: 0-1, removes dead ends to create loops (0 = perfect maze, 0.5 = half dead ends removed)
        this.braidingFactor = 0.3;
        // Extra wall removal: 0-1, creates additional shortcuts (0 = none, 0.1 = 10% extra walls removed)
        this.extraWallRemoval = 0.05;
        // ==============================================
        
        // Game settings
        this.cellSize = 45;  // Increased from 40 for larger cells and mouse
        this.wallThickness = 2;
        this.baseMazeSize = 10; // Starting maze size
        
        // Game state
        this.level = 1;
        this.moves = 0;
        this.startTime = null;
        this.timerInterval = null;
        this.gameWon = false;
        this.pendingWin = false; // Win detected but waiting for animation
        
        // Maze generation animation state
        this.isGeneratingMaze = false;
        this.generationSteps = [];
        this.currentGenStep = 0;
        this.displayGrid = null; // Grid state for animation display
        this.currentCarveHead = null; // Current position of the "carving" head
        
        // Player grid position (logical position in maze)
        this.player = { x: 0, y: 0 };
        
        // Player visual position (for smooth animation)
        this.playerVisual = { x: 0, y: 0 };
        
        // Animation settings
        this.moveSpeed = 8; // Cells per second
        this.isMoving = false;
        this.moveQueue = []; // Queue of pending moves
        
        // Game loop
        this.lastFrameTime = 0;
        this.animationFrameId = null;
        
        // Maze
        this.maze = null;
        this.mazeGenerator = null;
        this.exit = { x: 0, y: 0 };
        
        // Colors
        this.colors = {
            wall: '#4a90a4',
            background: '#1a1a2e',
            player: '#3b82f6',
            playerGlow: 'rgba(59, 130, 246, 0.3)',
            exit: '#4ade80',
            exitGlow: 'rgba(74, 222, 128, 0.3)',
            path: '#252540'
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.startNewGame();
        this.startGameLoop();
    }
    
    startGameLoop() {
        const gameLoop = (currentTime) => {
            // Calculate delta time in seconds
            const deltaTime = (currentTime - this.lastFrameTime) / 1000;
            this.lastFrameTime = currentTime;
            
            // Cap delta time to prevent huge jumps
            const cappedDelta = Math.min(deltaTime, 0.1);
            
            this.update(cappedDelta);
            this.render();
            
            this.animationFrameId = requestAnimationFrame(gameLoop);
        };
        
        this.lastFrameTime = performance.now();
        this.animationFrameId = requestAnimationFrame(gameLoop);
    }
    
    update(deltaTime) {
        // Always process movement animation, even during pending win
        // (gameWon blocks new input, but animation must complete)
        this.updatePlayerMovement(deltaTime);
    }
    
    updatePlayerMovement(deltaTime) {
        const targetX = this.player.x;
        const targetY = this.player.y;
        
        const dx = targetX - this.playerVisual.x;
        const dy = targetY - this.playerVisual.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 0.01) {
            // Snap to target when close enough
            this.playerVisual.x = targetX;
            this.playerVisual.y = targetY;
            this.isMoving = false;
            
            // If win was pending, now trigger the win celebration
            if (this.pendingWin) {
                this.triggerWin();
                return;
            }
            
            // Process next move in queue if any
            if (this.moveQueue.length > 0) {
                const nextMove = this.moveQueue.shift();
                this.tryMove(nextMove.dx, nextMove.dy);
            }
        } else {
            // Move towards target
            this.isMoving = true;
            const moveAmount = this.moveSpeed * deltaTime;
            
            if (moveAmount >= distance) {
                // Will reach target this frame
                this.playerVisual.x = targetX;
                this.playerVisual.y = targetY;
            } else {
                // Move partially towards target
                const ratio = moveAmount / distance;
                this.playerVisual.x += dx * ratio;
                this.playerVisual.y += dy * ratio;
            }
        }
    }
    
    setupEventListeners() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // New game button
        document.getElementById('new-game-btn').addEventListener('click', () => {
            this.level = 1;
            this.startNewGame();
        });
    }
    
    handleKeyDown(e) {
        if (this.gameWon || this.pendingWin || this.isGeneratingMaze) return;
        
        const key = e.key;
        let dx = 0, dy = 0;
        
        switch (key) {
            case 'ArrowUp':
                dy = -1;
                e.preventDefault();
                break;
            case 'ArrowDown':
                dy = 1;
                e.preventDefault();
                break;
            case 'ArrowLeft':
                dx = -1;
                e.preventDefault();
                break;
            case 'ArrowRight':
                dx = 1;
                e.preventDefault();
                break;
            default:
                return;
        }
        
        this.queueMove(dx, dy);
    }
    
    queueMove(dx, dy) {
        // If currently moving, queue the move (limit queue size)
        if (this.isMoving) {
            if (this.moveQueue.length < 2) {
                this.moveQueue.push({ dx, dy });
            }
            return;
        }
        
        this.tryMove(dx, dy);
    }
    
    tryMove(dx, dy) {
        const currentCell = this.maze[this.player.y][this.player.x];
        const newX = this.player.x + dx;
        const newY = this.player.y + dy;
        
        // Check bounds
        if (newX < 0 || newX >= this.getMazeWidth() || 
            newY < 0 || newY >= this.getMazeHeight()) {
            return false;
        }
        
        // Check walls
        let canMove = false;
        if (dx === 1 && !currentCell.walls.right) canMove = true;
        if (dx === -1 && !currentCell.walls.left) canMove = true;
        if (dy === 1 && !currentCell.walls.bottom) canMove = true;
        if (dy === -1 && !currentCell.walls.top) canMove = true;
        
        if (canMove) {
            this.player.x = newX;
            this.player.y = newY;
            this.isMoving = true;
            this.moves++;
            this.updateStats();
            this.checkWin();
            return true;
        }
        
        return false;
    }
    
    checkWin() {
        if (this.player.x === this.exit.x && this.player.y === this.exit.y) {
            // Mark win as pending - will trigger when animation completes
            this.pendingWin = true;
            this.moveQueue = []; // Clear any queued moves
        }
    }
    
    triggerWin() {
        this.pendingWin = false;
        this.gameWon = true;
        this.stopTimer();
        this.showMessage(`🎉 Level ${this.level} Complete!`);
        
        // Auto advance to next level after delay
        setTimeout(() => {
            this.hideMessage();
            this.level++;
            this.startNewGame();
        }, 2000);
    }
    
    getMazeWidth() {
        // Increase maze size with level
        return this.baseMazeSize + Math.floor((this.level - 1) * 2);
    }
    
    getMazeHeight() {
        return this.baseMazeSize + Math.floor((this.level - 1) * 2);
    }
    
    startNewGame() {
        this.gameWon = false;
        this.moves = 0;
        this.isGeneratingMaze = false;
        this.currentCarveHead = null;
        
        // Generate new maze
        const width = this.getMazeWidth();
        const height = this.getMazeHeight();
        
        // Limit maze size for playability
        const maxSize = 25;
        const actualWidth = Math.min(width, maxSize);
        const actualHeight = Math.min(height, maxSize);
        
        this.mazeGenerator = new MazeGenerator(actualWidth, actualHeight, {
            algorithm: this.mazeAlgorithm,
            braidingFactor: this.braidingFactor,
            extraWallRemoval: this.extraWallRemoval
        });
        
        // Resize canvas first
        this.canvas.width = actualWidth * this.cellSize;
        this.canvas.height = actualHeight * this.cellSize;
        
        if (this.ANIMATE_MAZE_GENERATION) {
            // Generate with step recording for animation
            this.maze = this.mazeGenerator.generate(true);
            this.generationSteps = this.mazeGenerator.getGenerationSteps();
            this.currentGenStep = 0;
            
            // Create a blank display grid (all walls, nothing visited)
            this.initDisplayGrid(actualWidth, actualHeight);
            this.isGeneratingMaze = true;
            
            // Start the animation
            this.animateMazeGeneration();
        } else {
            // Instant generation (no animation)
            this.maze = this.mazeGenerator.generate(false);
            this.finishMazeSetup();
        }
    }
    
    initDisplayGrid(width, height) {
        // Create a grid with all walls intact for animation
        this.displayGrid = [];
        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                row.push({
                    x: x,
                    y: y,
                    walls: { top: true, right: true, bottom: true, left: true },
                    visited: false
                });
            }
            this.displayGrid.push(row);
        }
    }
    
    animateMazeGeneration() {
        if (this.currentGenStep >= this.generationSteps.length) {
            // Animation complete
            this.isGeneratingMaze = false;
            this.currentCarveHead = null;
            this.displayGrid = null; // Use the real maze now
            this.finishMazeSetup();
            return;
        }
        
        const step = this.generationSteps[this.currentGenStep];
        
        if (step.type === 'visit') {
            // Mark cell as visited
            this.displayGrid[step.y][step.x].visited = true;
            this.currentCarveHead = { x: step.x, y: step.y };
        } else if (step.type === 'carve') {
            // Remove walls between cells
            const fromCell = this.displayGrid[step.fromY][step.fromX];
            const toCell = this.displayGrid[step.toY][step.toX];
            
            const dx = step.toX - step.fromX;
            const dy = step.toY - step.fromY;
            
            if (dx === 1) {
                fromCell.walls.right = false;
                toCell.walls.left = false;
            } else if (dx === -1) {
                fromCell.walls.left = false;
                toCell.walls.right = false;
            } else if (dy === 1) {
                fromCell.walls.bottom = false;
                toCell.walls.top = false;
            } else if (dy === -1) {
                fromCell.walls.top = false;
                toCell.walls.bottom = false;
            }
            
            toCell.visited = true;
            this.currentCarveHead = { x: step.toX, y: step.toY };
        } else if (step.type === 'backtrack') {
            // Just update the carve head position during backtrack
            this.currentCarveHead = { x: step.x, y: step.y };
        } else if (step.type === 'hunt') {
            // Hunt phase - jumping to a new location
            this.displayGrid[step.y][step.x].visited = true;
            this.currentCarveHead = { x: step.x, y: step.y };
        } else if (step.type === 'braid' || step.type === 'extra') {
            // Post-processing wall removal (braiding or extra shortcuts)
            const fromCell = this.displayGrid[step.fromY][step.fromX];
            const toCell = this.displayGrid[step.toY][step.toX];
            
            const dx = step.toX - step.fromX;
            const dy = step.toY - step.fromY;
            
            if (dx === 1) {
                fromCell.walls.right = false;
                toCell.walls.left = false;
            } else if (dx === -1) {
                fromCell.walls.left = false;
                toCell.walls.right = false;
            } else if (dy === 1) {
                fromCell.walls.bottom = false;
                toCell.walls.top = false;
            } else if (dy === -1) {
                fromCell.walls.top = false;
                toCell.walls.bottom = false;
            }
            
            this.currentCarveHead = { x: step.toX, y: step.toY };
        }
        
        this.currentGenStep++;
        
        // Schedule next step
        setTimeout(() => this.animateMazeGeneration(), this.mazeAnimationDelay);
    }
    
    finishMazeSetup() {
        // Set player start position
        const start = this.mazeGenerator.getStartPosition();
        this.player = { x: start.x, y: start.y };
        this.playerVisual = { x: start.x, y: start.y };
        this.isMoving = false;
        this.moveQueue = [];
        this.pendingWin = false;
        
        // Set exit position
        this.exit = this.mazeGenerator.getExitPosition();
        
        // Start timer
        this.startTimer();
        
        // Update display
        this.updateStats();
        this.render();
    }
    
    startTimer() {
        this.stopTimer();
        this.startTime = Date.now();
        this.timerInterval = setInterval(() => this.updateTimer(), 1000);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    updateTimer() {
        if (!this.startTime) return;
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        document.getElementById('time-display').textContent = 
            `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    updateStats() {
        document.getElementById('level-display').textContent = `Level: ${this.level}`;
        document.getElementById('moves-display').textContent = `Moves: ${this.moves}`;
    }
    
    render() {
        const ctx = this.ctx;
        const size = this.cellSize;
        
        // Clear canvas
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Choose which grid to render (animation grid or final maze)
        const gridToRender = this.isGeneratingMaze ? this.displayGrid : this.maze;
        
        if (!gridToRender) return;
        
        // Draw cells and walls
        for (let y = 0; y < gridToRender.length; y++) {
            for (let x = 0; x < gridToRender[y].length; x++) {
                const cell = gridToRender[y][x];
                const px = x * size;
                const py = y * size;
                
                // Draw cell background - show visited cells differently during generation
                if (this.isGeneratingMaze) {
                    ctx.fillStyle = cell.visited ? this.colors.path : this.colors.background;
                } else {
                    ctx.fillStyle = this.colors.path;
                }
                ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
                
                // Draw walls
                ctx.strokeStyle = this.colors.wall;
                ctx.lineWidth = this.wallThickness;
                ctx.lineCap = 'round';
                
                if (cell.walls.top) {
                    ctx.beginPath();
                    ctx.moveTo(px, py);
                    ctx.lineTo(px + size, py);
                    ctx.stroke();
                }
                if (cell.walls.right) {
                    ctx.beginPath();
                    ctx.moveTo(px + size, py);
                    ctx.lineTo(px + size, py + size);
                    ctx.stroke();
                }
                if (cell.walls.bottom) {
                    ctx.beginPath();
                    ctx.moveTo(px, py + size);
                    ctx.lineTo(px + size, py + size);
                    ctx.stroke();
                }
                if (cell.walls.left) {
                    ctx.beginPath();
                    ctx.moveTo(px, py);
                    ctx.lineTo(px, py + size);
                    ctx.stroke();
                }
            }
        }
        
        // During generation, draw the carve head
        if (this.isGeneratingMaze && this.currentCarveHead) {
            this.drawCarveHead();
        }
        
        // Only draw exit and player after maze is complete
        if (!this.isGeneratingMaze) {
            // Draw exit
            this.drawExit();
            
            // Draw player
            this.drawPlayer();
        }
    }
    
    drawCarveHead() {
        const ctx = this.ctx;
        const size = this.cellSize;
        const px = this.currentCarveHead.x * size + size / 2;
        const py = this.currentCarveHead.y * size + size / 2;
        const radius = size * 0.25;
        
        // Pulsing glow effect
        const pulse = 3 + Math.sin(performance.now() / 80) * 2;
        ctx.beginPath();
        ctx.arc(px, py, radius + pulse, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 200, 50, 0.4)';
        ctx.fill();
        
        // Carve head marker
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffc832';
        ctx.fill();
    }
    
    drawExit() {
        const ctx = this.ctx;
        const size = this.cellSize;
        const px = this.exit.x * size + size / 2;
        const py = this.exit.y * size + size / 2;
        
        // Exit emoji only - improved text rendering
        ctx.save();
        ctx.textRenderingOptimization = 'optimizeQuality';
        ctx.font = `${size * 0.65}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;  // Reduced by 15% from 0.8
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🧀', px, py + 2); // Centered in cell
        ctx.restore();
    }
    
    drawPlayer() {
        const ctx = this.ctx;
        const size = this.cellSize;
        
        // Use visual position for smooth animation
        const px = this.playerVisual.x * size + size / 2;
        const py = this.playerVisual.y * size + size / 2;
        
        // Player emoji only - improved text rendering
        ctx.save();
        ctx.textRenderingOptimization = 'optimizeQuality';
        ctx.font = `${size * 0.68}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;  // Reduced by 15% from 0.8
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🐭', px, py + 4); // Centered in cell
        ctx.restore();
    }
    
    showMessage(text) {
        const messageEl = document.getElementById('message');
        messageEl.textContent = text;
        messageEl.classList.remove('hidden');
    }
    
    hideMessage() {
        document.getElementById('message').classList.add('hidden');
    }
}

// Start game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new MazerGame();
});
