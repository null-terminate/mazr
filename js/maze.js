/**
 * Maze Generator with multiple algorithms and complexity options
 * 
 * Algorithms:
 * - 'backtrack': Recursive backtracking (long corridors, simple)
 * - 'kruskal': Randomized Kruskal's (more branching, moderate)
 * - 'huntAndKill': Hunt and Kill (complex patterns, challenging)
 * 
 * Complexity options:
 * - braidingFactor: 0-1, removes dead ends to create loops (0 = perfect maze, 1 = no dead ends)
 * - extraWallRemoval: 0-1, removes additional walls for multiple paths
 */
class MazeGenerator {
    constructor(width, height, options = {}) {
        this.width = width;
        this.height = height;
        this.grid = [];
        this.generationSteps = []; // Records each step for animated playback
        
        // Algorithm and complexity options
        this.algorithm = options.algorithm || 'kruskal'; // 'backtrack', 'kruskal', 'huntAndKill'
        this.braidingFactor = options.braidingFactor ?? 0.3; // Remove 30% of dead ends by default
        this.extraWallRemoval = options.extraWallRemoval ?? 0.05; // Remove 5% extra walls
        
        this.init();
    }

    init() {
        // Initialize grid with all walls
        // Each cell has 4 walls: top, right, bottom, left
        this.grid = [];
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                row.push({
                    x: x,
                    y: y,
                    walls: { top: true, right: true, bottom: true, left: true },
                    visited: false
                });
            }
            this.grid.push(row);
        }
    }

    generate(recordSteps = false) {
        this.init();
        this.generationSteps = [];
        
        // Choose algorithm
        switch (this.algorithm) {
            case 'kruskal':
                this.generateKruskal(recordSteps);
                break;
            case 'huntAndKill':
                this.generateHuntAndKill(recordSteps);
                break;
            case 'backtrack':
            default:
                this.generateBacktrack(recordSteps);
                break;
        }
        
        // Post-processing for complexity
        if (this.braidingFactor > 0) {
            this.applyBraiding(recordSteps);
        }
        if (this.extraWallRemoval > 0) {
            this.applyExtraWallRemoval(recordSteps);
        }
        
        return this.grid;
    }
    
    /**
     * Recursive Backtracking - creates long winding corridors
     */
    generateBacktrack(recordSteps) {
        const stack = [];
        const startCell = this.grid[0][0];
        startCell.visited = true;
        stack.push(startCell);

        if (recordSteps) {
            this.generationSteps.push({
                type: 'visit',
                x: startCell.x,
                y: startCell.y
            });
        }

        while (stack.length > 0) {
            const current = stack[stack.length - 1];
            const neighbors = this.getUnvisitedNeighbors(current);

            if (neighbors.length === 0) {
                stack.pop();
                if (recordSteps) {
                    this.generationSteps.push({
                        type: 'backtrack',
                        x: current.x,
                        y: current.y
                    });
                }
            } else {
                const next = neighbors[Math.floor(Math.random() * neighbors.length)];
                this.removeWall(current, next);
                next.visited = true;
                stack.push(next);

                if (recordSteps) {
                    this.generationSteps.push({
                        type: 'carve',
                        fromX: current.x,
                        fromY: current.y,
                        toX: next.x,
                        toY: next.y
                    });
                }
            }
        }
    }
    
    /**
     * Hunt and Kill - creates more complex, twisty passages
     */
    generateHuntAndKill(recordSteps) {
        let current = this.grid[0][0];
        current.visited = true;
        
        if (recordSteps) {
            this.generationSteps.push({
                type: 'visit',
                x: current.x,
                y: current.y
            });
        }
        
        while (current) {
            // Kill phase: random walk from current cell
            const neighbors = this.getUnvisitedNeighbors(current);
            
            if (neighbors.length > 0) {
                const next = neighbors[Math.floor(Math.random() * neighbors.length)];
                this.removeWall(current, next);
                next.visited = true;
                
                if (recordSteps) {
                    this.generationSteps.push({
                        type: 'carve',
                        fromX: current.x,
                        fromY: current.y,
                        toX: next.x,
                        toY: next.y
                    });
                }
                
                current = next;
            } else {
                // Hunt phase: scan for unvisited cell adjacent to visited cell
                current = null;
                
                huntLoop:
                for (let y = 0; y < this.height; y++) {
                    for (let x = 0; x < this.width; x++) {
                        const cell = this.grid[y][x];
                        if (!cell.visited) {
                            const visitedNeighbors = this.getVisitedNeighbors(cell);
                            if (visitedNeighbors.length > 0) {
                                // Connect to a random visited neighbor
                                const neighbor = visitedNeighbors[Math.floor(Math.random() * visitedNeighbors.length)];
                                this.removeWall(cell, neighbor);
                                cell.visited = true;
                                
                                if (recordSteps) {
                                    this.generationSteps.push({
                                        type: 'hunt',
                                        x: cell.x,
                                        y: cell.y
                                    });
                                    this.generationSteps.push({
                                        type: 'carve',
                                        fromX: neighbor.x,
                                        fromY: neighbor.y,
                                        toX: cell.x,
                                        toY: cell.y
                                    });
                                }
                                
                                current = cell;
                                break huntLoop;
                            }
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Kruskal's Algorithm - creates more uniform, branching mazes
     */
    generateKruskal(recordSteps) {
        // Create list of all walls
        const walls = [];
        const sets = new Map(); // Union-Find structure
        
        // Initialize each cell as its own set
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                sets.set(`${x},${y}`, `${x},${y}`);
                cell.visited = true; // Mark all as visited for Kruskal's
                
                // Add walls (only right and bottom to avoid duplicates)
                if (x < this.width - 1) {
                    walls.push({ x1: x, y1: y, x2: x + 1, y2: y, dir: 'right' });
                }
                if (y < this.height - 1) {
                    walls.push({ x1: x, y1: y, x2: x, y2: y + 1, dir: 'bottom' });
                }
            }
        }
        
        // Shuffle walls
        for (let i = walls.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [walls[i], walls[j]] = [walls[j], walls[i]];
        }
        
        // Find root of set (with path compression)
        const findRoot = (key) => {
            if (sets.get(key) !== key) {
                sets.set(key, findRoot(sets.get(key)));
            }
            return sets.get(key);
        };
        
        // Process each wall
        for (const wall of walls) {
            const key1 = `${wall.x1},${wall.y1}`;
            const key2 = `${wall.x2},${wall.y2}`;
            const root1 = findRoot(key1);
            const root2 = findRoot(key2);
            
            if (root1 !== root2) {
                // Cells are in different sets - remove wall and unite sets
                const cell1 = this.grid[wall.y1][wall.x1];
                const cell2 = this.grid[wall.y2][wall.x2];
                this.removeWall(cell1, cell2);
                sets.set(root1, root2);
                
                if (recordSteps) {
                    this.generationSteps.push({
                        type: 'carve',
                        fromX: wall.x1,
                        fromY: wall.y1,
                        toX: wall.x2,
                        toY: wall.y2
                    });
                }
            }
        }
    }
    
    /**
     * Braiding: Remove dead ends to create loops
     */
    applyBraiding(recordSteps) {
        const deadEnds = this.findDeadEnds();
        const toRemove = Math.floor(deadEnds.length * this.braidingFactor);
        
        // Shuffle and remove some dead ends
        for (let i = deadEnds.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deadEnds[i], deadEnds[j]] = [deadEnds[j], deadEnds[i]];
        }
        
        for (let i = 0; i < toRemove; i++) {
            const cell = deadEnds[i];
            const wallNeighbors = this.getWalledNeighbors(cell);
            
            if (wallNeighbors.length > 0) {
                const neighbor = wallNeighbors[Math.floor(Math.random() * wallNeighbors.length)];
                this.removeWall(cell, neighbor);
                
                if (recordSteps) {
                    this.generationSteps.push({
                        type: 'braid',
                        fromX: cell.x,
                        fromY: cell.y,
                        toX: neighbor.x,
                        toY: neighbor.y
                    });
                }
            }
        }
    }
    
    /**
     * Remove extra walls to create additional paths
     */
    applyExtraWallRemoval(recordSteps) {
        const walls = [];
        
        // Collect all internal walls
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                if (x < this.width - 1 && cell.walls.right) {
                    walls.push({ cell, neighbor: this.grid[y][x + 1], dir: 'right' });
                }
                if (y < this.height - 1 && cell.walls.bottom) {
                    walls.push({ cell, neighbor: this.grid[y + 1][x], dir: 'bottom' });
                }
            }
        }
        
        // Remove some walls
        const toRemove = Math.floor(walls.length * this.extraWallRemoval);
        for (let i = walls.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [walls[i], walls[j]] = [walls[j], walls[i]];
        }
        
        for (let i = 0; i < toRemove; i++) {
            const { cell, neighbor } = walls[i];
            this.removeWall(cell, neighbor);
            
            if (recordSteps) {
                this.generationSteps.push({
                    type: 'extra',
                    fromX: cell.x,
                    fromY: cell.y,
                    toX: neighbor.x,
                    toY: neighbor.y
                });
            }
        }
    }
    
    findDeadEnds() {
        const deadEnds = [];
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                let wallCount = 0;
                if (cell.walls.top) wallCount++;
                if (cell.walls.right) wallCount++;
                if (cell.walls.bottom) wallCount++;
                if (cell.walls.left) wallCount++;
                
                // Dead end has 3 walls
                if (wallCount === 3) {
                    deadEnds.push(cell);
                }
            }
        }
        return deadEnds;
    }
    
    getWalledNeighbors(cell) {
        const neighbors = [];
        const { x, y } = cell;
        
        if (y > 0 && cell.walls.top) {
            neighbors.push(this.grid[y - 1][x]);
        }
        if (x < this.width - 1 && cell.walls.right) {
            neighbors.push(this.grid[y][x + 1]);
        }
        if (y < this.height - 1 && cell.walls.bottom) {
            neighbors.push(this.grid[y + 1][x]);
        }
        if (x > 0 && cell.walls.left) {
            neighbors.push(this.grid[y][x - 1]);
        }
        
        return neighbors;
    }
    
    getVisitedNeighbors(cell) {
        const neighbors = [];
        const { x, y } = cell;
        
        if (y > 0 && this.grid[y - 1][x].visited) {
            neighbors.push(this.grid[y - 1][x]);
        }
        if (x < this.width - 1 && this.grid[y][x + 1].visited) {
            neighbors.push(this.grid[y][x + 1]);
        }
        if (y < this.height - 1 && this.grid[y + 1][x].visited) {
            neighbors.push(this.grid[y + 1][x]);
        }
        if (x > 0 && this.grid[y][x - 1].visited) {
            neighbors.push(this.grid[y][x - 1]);
        }
        
        return neighbors;
    }

    /**
     * Get the recorded generation steps for animated playback
     */
    getGenerationSteps() {
        return this.generationSteps;
    }

    getUnvisitedNeighbors(cell) {
        const neighbors = [];
        const { x, y } = cell;

        // Top
        if (y > 0 && !this.grid[y - 1][x].visited) {
            neighbors.push(this.grid[y - 1][x]);
        }
        // Right
        if (x < this.width - 1 && !this.grid[y][x + 1].visited) {
            neighbors.push(this.grid[y][x + 1]);
        }
        // Bottom
        if (y < this.height - 1 && !this.grid[y + 1][x].visited) {
            neighbors.push(this.grid[y + 1][x]);
        }
        // Left
        if (x > 0 && !this.grid[y][x - 1].visited) {
            neighbors.push(this.grid[y][x - 1]);
        }

        return neighbors;
    }

    removeWall(current, next) {
        const dx = next.x - current.x;
        const dy = next.y - current.y;

        if (dx === 1) {
            // Next is to the right
            current.walls.right = false;
            next.walls.left = false;
        } else if (dx === -1) {
            // Next is to the left
            current.walls.left = false;
            next.walls.right = false;
        } else if (dy === 1) {
            // Next is below
            current.walls.bottom = false;
            next.walls.top = false;
        } else if (dy === -1) {
            // Next is above
            current.walls.top = false;
            next.walls.bottom = false;
        }
    }

    // Get start position (top-left area)
    getStartPosition() {
        return { x: 0, y: 0 };
    }

    // Get exit position (bottom-right area)
    getExitPosition() {
        return { x: this.width - 1, y: this.height - 1 };
    }
}
