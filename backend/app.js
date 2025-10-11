import express from "express";
const app = express();
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { connectDatabase } from "./config/dbConnect.js";
import errorMiddleware from "./middlewares/errors.js";

import path from 'path'
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔹 NEW: import the raw webhook routes (must be mounted before express.json)
import webhookRoutes from "./routes/webhooks.js";   // <-- ADD THIS LINE


// Handle Uncaught exceptions
process.on("uncaughtException", (err) =>{
    console.log(`ERROR: ${err}`);
    console.log("Shutting down due to uncaught exception");
    process.exit(1);
});

if(process.env.NODE_ENV !== 'PRODUCTION'){
    dotenv.config({path: "backend/config/config.env"});
}

// connecting to database
connectDatabase();


/* 🔹 MOUNT WEBHOOKS FIRST (raw body) */
app.use("/api/v1/webhooks/square", express.raw({ type: "*/*" }), webhookRoutes);

app.use(express.json({ limit: "10mb"}));
app.use(cookieParser());

// import all routes
import productRoutes from "./routes/products.js";
import authRoutes from "./routes/auth.js";
import orderRoutes from "./routes/order.js";
import paymentRoutes from "./routes/payment.js";
import cartRoutes from "./routes/cartRoutes.js";
import userRoutes from "./routes/user.js";
import couponRoutes from "./routes/coupons.js";

app.use("/api/v1", productRoutes);
app.use("/api/v1", authRoutes);
app.use("/api/v1", orderRoutes);
app.use("/api/v1", paymentRoutes);
app.use("/api/v1", cartRoutes);
app.use("/api/v1", userRoutes);
app.use("/api/v1", couponRoutes);

if(process.env.NODE_ENV === "PRODUCTION") {
    app.use(express.static(path.join(__dirname, "../frontend/build")));

    app.get(/^(?!\/api\/).*/, (req, res) => {
        res.sendFile(path.resolve(__dirname, "../frontend/build/index.html"));
    });
}

// Using error middleware
app.use(errorMiddleware);


const server = app.listen(process.env.PORT, () => {
    console.log(
        `Server started on PORT:${process.env.PORT} in ${process.env.NODE_ENV} mode.`
    );
});

//handle unhgandled promise rejections
process.on("unhandledRejection", (err) => {
    console.log(`ERROR: ${err}`);
    console.log("Shutting down server due to Unhandled Promise Rejection");
    server.close(() => {
        process.exit(1);
    });
});