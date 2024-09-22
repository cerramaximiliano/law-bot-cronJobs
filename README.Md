
# Law Bot CronJobs

This project is an automation system that uses cron jobs to scrape and manage legal data from different platforms. It tracks postal data, resolves CAPTCHA challenges, and notifies users through a Telegram bot. This system helps streamline legal data collection for law professionals in Argentina.

## Features

- **Automated Scraping**: Extracts legal and postal data using Puppeteer.
- **CAPTCHA Solving**: Supports 2Captcha, CapSolver, and AntiCaptcha for CAPTCHA resolution.
- **Telegram Notifications**: Sends updates to users via a Telegram bot.
- **Proxy Management**: Uses authenticated proxies for scraping.
- **Cron Scheduling**: Automates tasks periodically using cron jobs.

## Technologies

- **Node.js**: Backend runtime for running the app.
- **Puppeteer**: A headless browser for web scraping.
- **2Captcha, CapSolver, AntiCaptcha**: Integrations for automated CAPTCHA solving.
- **MongoDB**: Database for storing and managing tracking data.
- **PM2**: Process manager for running cron jobs.
- **Axios**: For making HTTP requests.
- **Telegraf**: Telegram bot framework for handling notifications.

## Project Structure

```bash
law-bot-cronJobs/
│
├── config/                   # Configuration files
│   └── logger.js             # Logger setup
│
├── src/                      # Source files
│   ├── scrapingService.js    # Handles scraping logic
│   ├── captchaService.js     # Handles CAPTCHA solving
│   ├── trackingController.js # Database interaction for tracking data
│   ├── mouseMovementService.js # Simulates human-like mouse movements
│   └── jobs/                 # Contains cron jobs for scraping
│
├── app.js                    # Entry point for the app
├── package.json              # Project dependencies
├── ecosystem.config.js       # PM2 configuration
└── .gitignore                # Files and directories to ignore in git
```

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/cerramaximiliano/law-bot-cronJobs.git
   ```

2. Install the required dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   - `RECAPTCHA_API_KEY`
   - `RECAPTCHA_USER`, `RECAPTCHA_PASSWORD`
   - `MONGO_URI`

4. Start the application using PM2:
   ```bash
   pm2 start ecosystem.config.js
   ```

## Usage

- **Cron Jobs**: The bot runs scheduled tasks to scrape data and check for updates.
- **CAPTCHA Solving**: Automated CAPTCHA solving during scraping sessions.
- **Telegram Bot**: Users receive notifications through Telegram for updates and tracking.

## License

This project is licensed under the MIT License.