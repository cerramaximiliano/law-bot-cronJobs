// utils.js

const timeout = (millis) =>
    new Promise((resolve) => setTimeout(resolve, millis));
  
  const randomDelay = (minSeconds, maxSeconds) => {
    const minMilliseconds = minSeconds * 1000;
    const maxMilliseconds = maxSeconds * 1000;
    return Math.floor(Math.random() * (maxMilliseconds - minMilliseconds + 1)) + minMilliseconds;
  };
  
  const simulateHumanInteraction = async (page) => {
    // Movimiento de mouse aleatorio
    await page.mouse.move(
      Math.floor(Math.random() * 800),
      Math.floor(Math.random() * 600),
      { steps: 10 }
    );
    await randomDelay();
  
    // Scroll en la página
    await page.evaluate(() => {
      window.scrollBy(0, Math.floor(Math.random() * 500));
    });
    await randomDelay();
  
    // Click en una zona neutral
    await page.mouse.click(
      Math.floor(Math.random() * 800),
      Math.floor(Math.random() * 600)
    );
    await randomDelay();
  };
  
  

  module.exports = {
    timeout,
    randomDelay,
    simulateHumanInteraction,
  };
  