const { Web3 } = require('web3');
const axios = require('axios');

const ABI_OF_FACTORY_CONTRACT = require('./UniswapV2FactoryABI.json');
const ABI_OF_PAIR_CONTRACT = require('@uniswap/v2-core/build/IUniswapV2Pair.json');

const web3 = new Web3(new Web3.providers.HttpProvider('https://goerli.infura.io/v3/d0fc82ef50f7498092a59a55cc3510b2')); // rpc

web3.eth
  .getBlockNumber()
  .then((result) => {
    console.log('Результат:', result);
  })
  .catch((error) => {
    console.error('Ошибка:', error);
  });

const factoryAddress = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
const tokenID = 'ethereum';

const ABI_OF_FACTORY_CONTRACT_PARSED = JSON.parse(ABI_OF_FACTORY_CONTRACT.result);
const ABI_OF_PAIR_CONTRACT_PARSED = ABI_OF_PAIR_CONTRACT.abi;

const factoryContract = new web3.eth.Contract(ABI_OF_FACTORY_CONTRACT_PARSED, factoryAddress);

const getAllPairs = async () => {
  const allPairs = await factoryContract.methods.allPairsLength().call();
  const pairs = [];
  console.log(`allPairs length: ${allPairs}`);
//   for (let i = 0; i < allPairs; i++) { // см. Технические нюансы п.1
    for (let i = 0; i < 100; i++) {
    const pairAddress = await factoryContract.methods.allPairs(i).call();
    pairs.push(pairAddress);
  }

  return pairs;
};

const getPoolBalances = async (pairs) => {
  const tokenBalances = [];
  const ethBalances = [];
  for (let i = 0; i < pairs.length; i++) {
    const pairContract = new web3.eth.Contract(ABI_OF_PAIR_CONTRACT_PARSED, pairs[i]);
    const { reserve0, reserve1 } = await pairContract.methods.getReserves().call();

    tokenBalances.push(reserve0);
    ethBalances.push(reserve1);
  }
  return { tokenBalances, ethBalances };
};

const getTokenPrice = async () => {
  const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${tokenID}&vs_currencies=usd`);
  const tokenPrice = response.data[tokenID].usd;
  return tokenPrice;
};

const calculateTVLs = (tokenBalances, ethBalances, tokenPrice, pairs) => {
  const tvls = [];
  for (let i = 0; i < tokenBalances.length; i++) {
    const tvl = Number(tokenBalances[i]) * tokenPrice + Number(ethBalances[i]);
    const pairAddress = pairs[i];

    const tvlObj = {
      address: pairAddress,
      tvl: tvl.toString(),
    };

    tvls.push(tvlObj);
  }
  return tvls;
};

const getTop25Pairs = (tvls) => {
  const sortedPairs = tvls.slice().sort((a, b) => Number(b.tvl) - Number(a.tvl));
  return sortedPairs.slice(0, 25);
};

const execute = async () => {

  const pairs = await getAllPairs();
  // console.log(`All pairs: ${pairs}`);

  const { tokenBalances, ethBalances } = await getPoolBalances(pairs);
  // console.log(`Reserve Token: ${tokenBalances}`);
  // console.log(`Reserve Eth: ${ethBalances}`);

  const tokenPrice = await getTokenPrice();
  // console.log(`Price ETH: ${tokenPrice}`);

  const tvls = calculateTVLs(tokenBalances, ethBalances, tokenPrice, pairs);

  const top25Pairs = getTop25Pairs(tvls);

  for (let i = 0; i < top25Pairs.length; i++) {
    const pool = top25Pairs[i];
    console.log(`Top ${i + 1} Pool: ${pool.address} - TVL: ${pool.tvl}`);
  }
};

execute();
