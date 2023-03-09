const express = require('express');
const cors = require('cors');
const Moralis = require('moralis').default;
const {EvmChain} = require('@moralisweb3/common-evm-utils');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const  jwt = require('jsonwebtoken');

const app = express();
const port = 3000;
const chain = EvmChain.ARBITRUM;
const address = process.env.ADDRESS;


app.use(express.json());
app.use(cookieParser());

//origin is the url of the frontend
app.use(cors({
    origin: process.env.REACT_URL,
    credentials: true,
}));


const config = {
    domain: process.env.APP_DOMAIN,
    statement: 'Please sign this message to confirm your identity.',
    uri: process.env.REACT_URL,
    timeout: 60,
};

// request message to be signed by client
app.post('/request-message', async (req, res) => {
    const {address, chain, network} = req.body;
    try{
        const message = await Moralis.Auth.requestMessage({
            address,
            chain,
            network,
            ...config,
        });
        res.status(200).json(message);
    }   catch(error) {
        res.status(400).json({error: error.message});
        console.error(error);
    }
});

app.post('/verify', async (req, res) => {
    try {
        const {message, signature} = req.body;

        const { address, profileId } = (
            await Moralis.Auth.verify({
                message,
                signature,
                networkType: 'evm',
            })

        ).raw;

        const user = { address, profileId, signature };

        //create JWT token
        const token = jwt.sign(user, process.env.AUTH_SECRET);

        //set JWT cookie
        res.cookie('jwt', token, {
            httpOnly: true,
        });
        res.status(200).json(user);
    } catch(error) {
        res.status(400).json({error: error.message});
        console.error(error);
    }
});

app.get('/authenticate', async (req, res) => {
    const token = req.cookies.jwt;
    if (!token) return res.status(403); //if user has no jwt token, return 403 forbidden
    try{
        const data = jwt.verify(token, process.env.AUTH_SECRET);
        res.json(data);
    } catch {
        return res.sendStatus(403);
    }
});

app.get('/logout', async (req, res) => {
    try{
        res.clearCookie('jwt');
        return res.sendStatus(200);
    } catch {
        return res.sendStatus(403);
    }
});
    

app.get('/', (req, res) => res.send('hello world'));

const startServer = async () => {
    await Moralis.start({
        apiKey: process.env.MORALIS_API_KEY,
    });
};



const getDemoData = async () => {
    const nativeBalance = await Moralis.EvmApi.balance.getNativeBalance({
        address,
        chain,
    })
    const native = nativeBalance.result.balance.ether;

    const tokenBalances = await Moralis.EvmApi.token.getWalletTokenBalances({
        address,
        chain,
    })
    const tokens = tokenBalances.result.map(token => token.display());

    const nftsBalances = await Moralis.EvmApi.nft.getWalletNFTs({
        address,
        chain,
        limit: 10,
    })
    const nfts = nftsBalances.result.map(nft =>({
        name: nft.result.name,
        amount: nft.result.amount,
        metadata: nft.result.metadata,
    }));
 
    return {native, tokens, nfts};
}


app.get("/demo", async (req, res) => {
    try{
        const data = await getDemoData();
        res.status(200)
        res.json(data);
    }catch(error) {
        console.error(error);
        res.status(500);
        res.json({error: error.message});
    }
})


app.listen(port, () => console.log(`Example app listening on port ${port}!`));
startServer();