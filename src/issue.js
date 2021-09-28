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
import { initHorizon } from "./helpers/horizon.js";

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

    await fundAccount(asset.issuer); // TODO: Only for testnet, no need to fund existing accounts
    await fundAccount(asset.distributor); // TODO: Only for testnet
}

export const fundAccount = async (pair) => {
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
            amount: '10000000000', // TODO: Should be changeable
        }))
        .setTimeout(30)
        .build();

    transaction.sign(asset.issuer);

    return Horizon.submitTransaction(transaction);
};

export async function issue(code) {
    console.log("========== ISSUING ==========");

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

            console.log(`[${asset.code}]:`,"Distributing asset.")
            await distributeAsset(asset, fee);
        });
    }
}