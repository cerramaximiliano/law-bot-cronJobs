Law Bot CronJobs
This project is a cron-based automation system designed to scrape, process, and manage legal data from different platforms. The bot automates tasks such as tracking postal data, resolving CAPTCHA challenges, and notifying users through a Telegram bot.

Features
Automated Scraping: Extracts data like postal tracking using Puppeteer.
CAPTCHA Solving: Integrates services like 2Captcha, CapSolver, and AntiCaptcha for automated CAPTCHA resolution.
Telegram Notifications: Sends updates through a Telegram bot.
Proxy Management: Uses authenticated proxies for secure scraping.
Cron Scheduling: Automates tasks periodically.
Technologies
Node.js: Backend runtime.
Puppeteer: Web scraping library.
2Captcha, CapSolver, AntiCaptcha: CAPTCHA solving services.
MongoDB: Database for storing tracking data.
PM2: Process manager for running cron jobs.
Axios: HTTP client for making API requests.
Telegraf: Telegram bot framework.
Project Structure
bash
Copiar código
law-bot-cronJobs/
│
├── config/                 # Configuration files
│   └── logger.js           # Logger setup
│
├── src/                    # Source files
│   ├── scrapingService.js  # Handles scraping logic
│   ├── captchaService.js   # CAPTCHA solving logic
│   ├── trackingController.js # Database interaction for tracking data
│   ├── mouseMovementService.js # Simulates human-like mouse movements
│   └── jobs/               # Contains cron jobs
│
├── app.js                  # Entry point
├── package.json            # Project dependencies
├── ecosystem.config.js     # PM2 configuration for running cron jobs
└── .gitignore              # Files and directories to ignore in git
Setup
Clone the repository:

bash
Copiar código
git clone https://github.com/cerramaximiliano/law-bot-cronJobs.git
Install dependencies:

bash
Copiar código
npm install
Set environment variables:

RECAPTCHA_API_KEY
RECAPTCHA_USER, RECAPTCHA_PASSWORD
MONGO_URI
Run the app using PM2:

bash
Copiar código
pm2 start ecosystem.config.js
Usage
Running Cron Jobs: The bot periodically scrapes data and checks for updates.
Resolving CAPTCHA: Automated CAPTCHA resolution integrated into scraping flows.
Notifications: Users receive updates via the Telegram bot.
License
This project is licensed under the MIT License.