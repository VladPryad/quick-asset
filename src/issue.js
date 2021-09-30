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

    if (asset.code != "XLM") {
        if( !asset.issuer) {
            console.log(`No issuer for ${asset.code}, using random.`)
            asset.issuer = Keypair.random();
        } else if (!validSeed(asset.issuer)) {
            console.log(`Invalid issuer for ${asset.code}, using random.`)
            asset.issuer = Keypair.random();
        } else {
            asset.issuer = Keypair.fromSecret(asset.issuer); 
        }
    } else {
        asset.issuer = null;
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

    if ( asset.code != "XLM") fundAccount(asset.issuer); // TODO: Only for testnet, no need to fund existing accounts
    await fundAccount(asset.distributor); // TODO: Only for testnet

    if (asset.code  == "XLM") {
        asset.asset = Asset.native();
    } else {
        asset.asset = new Asset(asset.code, asset.issuer.publicKey());
    }
}

export const fundAccount = async (pair) => {
    console.log("Starting funding " + pair.publicKey());
    return await Horizon.friendbot(pair.publicKey()).call().catch((e) => console.log("ERROR IN FRIENDBOT: ", e.response, pair.publicKey()));
};

const validPk = pk => StrKey.isValidEd25519PublicKey(pk);
const validSeed = seed => StrKey.isValidEd25519SecretSeed(seed);

const Horizon = initHorizon();

const assets = getAssets();

const createDistributor = async (asset, fee) => {

    if (asset.code == "XLM") {
        console.log("Native asset, no need to trust ", asset.code);
        return true;
    }

    console.log(`[${asset.code}]:`,"Changing distributors trustlines...")

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

export async function issue() {
    console.log("========== ISSUING ==========");

    const fee = await Horizon.fetchBaseFee();

    function startIssuing(asset) {
        return new Promise(async (res, rej) => {
            console.log(`[${asset.code}]:`,"Preparing accounts...")
        await initAsset(asset);

        console.log(`[${asset.code}]:`,"Saving credentials...")
        saveCreds(asset);

        await createDistributor(asset, fee);

        if (asset.code !== "XLM") {
            console.log(`[${asset.code}]:`,"Distributing asset...")
            await distributeAsset(asset, fee);
        } else {
            console.log("Native asset, no need to distribute ", asset.code);
        }
        

        res(true);
        })
    }
    const promises = assets.map(startIssuing);

    return Promise.all(promises);

}