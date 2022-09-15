import winston from "winston";

export const logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      level: "info",
      format: winston.format.combine(
        winston.format.colorize({
          message: true,
        }),
        winston.format.printf((info) => info.message)
      ),
    }),
  ],
});
