import { getConfig, getAssets } from "../config.js";
import {
    TransactionBuilder,
    Networks,
    Operation,
    Asset,
    FederationServer,
    StrKey,
    Keypair,
    Server
} from 'stellar-sdk';
import {
    PUBLIC_HORIZON_URL,
    TEST_HORIZON_URL,
    TEST_HORIZON_PASSPHRASE
 } from "../../config.js";

export function initHorizon() {
    if (getConfig("network") === "public") return new Server(PUBLIC_HORIZON_URL);

    if (getConfig("network") === "custom") {
        if (!getConfig("horizon") || !getConfig("passphrase")) {
            console.log("No custom horizon provided, using testnet.")
        } else {
            return new Server(getConfig("horizon"));
        }
    }

    return new Server(TEST_HORIZON_URL);
}