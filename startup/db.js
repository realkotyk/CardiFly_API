import { connect } from "mongoose";

export default async function dbConnection() {
    const connection = await connect(process.env.MONGODB_URL);
    console.log(`Mongo connected to: ${connection.connection.name}`);
}
