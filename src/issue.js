import { getConfig, getAssets } from "./config.js";
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
 } from "../config.js";

 import saveCreds from "./helpers/saveCreds.js";


function initHorizon() {
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
async function initAsset(asset) {
    if( !asset.issuer) {
        console.log(`No issuer for ${asset.code}, using random.`)
        asset.issuer = Keypair.random();
    } else if (!validSeed(asset.issuer)) {
        console.log(`Invalid issuer for ${asset.code}, using random.`)
        asset.issuer = Keypair.random();
    } else {
        asset.issuer = Keypair.fromSecret(asset.issuer); 
    }

    if( !asset.distributor) {
        console.log(`No distributor for ${asset.code}, using random.`)
        asset.distributor = Keypair.random();
    } else if (!validSeed(asset.distributor)) {
        console.log(`Invalid distributor for ${asset.code}, using random.`)
        asset.distributor = Keypair.random();
    } else {
        asset.distributor = Keypair.fromSecret(asset.distributor); 
    }

    await fundAccount(asset.issuer); // TODO: Only for testnet
    await fundAccount(asset.distributor); // TODO: Only for testnet
}
const fundAccount = async (pair) => {
    return Horizon.friendbot(pair.publicKey()).call();
};

const validPk = pk => StrKey.isValidEd25519PublicKey(pk);
const validSeed = seed => StrKey.isValidEd25519SecretSeed(seed);

const Horizon = initHorizon();

const assets = getAssets();

const createDistributor = async (asset, fee) => {

    const account = await Horizon.loadAccount(asset.distributor.publicKey());

    const transaction = new TransactionBuilder(account, { fee, networkPassphrase: TEST_HORIZON_PASSPHRASE }) // TODO: Use other nets, encapsulate TransBuilder
        .addOperation(Operation.changeTrust({
            asset: new Asset(asset.code, asset.issuer.publicKey()),
        }))
        .setTimeout(30)
        .build();

    transaction.sign(asset.distributor);

    return Horizon.submitTransaction(transaction);
};

const distributeAsset = async (asset, fee) => {
    const account = await Horizon.loadAccount(asset.issuer.publicKey());

    const transaction = new TransactionBuilder(account, { fee, networkPassphrase: TEST_HORIZON_PASSPHRASE })
        .addOperation(Operation.payment({
            destination: asset.distributor.publicKey(),
            asset: new Asset(asset.code, asset.issuer.publicKey()),
            amount: '100000000', // TODO: Should be changeable
        }))
        .setTimeout(30)
        .build();

    transaction.sign(asset.issuer.secret());

    return Horizon.submitTransaction(transaction);
};

export async function issue(code) {
    const fee = await Horizon.fetchBaseFee();
    console.log('FEE: ', fee);

    if (!code) {
        assets.forEach( async asset => {
            console.log(`[${asset.code}]:`,"Preparing accounts.")
            await initAsset(asset);

            console.log(`[${asset.code}]:`,"Saving credentials.")
            saveCreds(asset);

            console.log(`[${asset.code}]:`,"Changing distributors trustlines.")
            await createDistributor(asset, fee);
        });
    }
}