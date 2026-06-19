import { app } from "./app";
import { config } from "./shared/config/config";
import { Database } from "./shared/database/db";
import { registerEVent } from "./shared/database/index";

const PORT = config.PORT;

const startServer = async () => {
  await Database.connectDB();
  registerEVent();

  const server = app.listen(PORT, () => {
    console.log("=================================");
    console.log(`🚀 Server running on PORT ${PORT}`);
    console.log("=================================");
  });

  server.on("error", (err: Error) => {
    console.error("Server Error:", err.message);
    process.exit(1);
  });
};

startServer();
