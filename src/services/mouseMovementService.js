// mouseMovementService.js

const simulateHumanLikeMouseMovements = async (page) => {
    const width = 800;
    const height = 600;
    
    for (let i = 0; i < 10; i++) {
      const randomX = Math.floor(Math.random() * width);
      const randomY = Math.floor(Math.random() * height);
      await page.mouse.move(randomX, randomY);
      await new Promise((resolve) => setTimeout(resolve, 1254)); // Espera de 1 segundo
    }
  };
  
  module.exports = {
    simulateHumanLikeMouseMovements,
  };
  