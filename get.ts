import handler from "./libs/handler-lib";
import dynamoDb from "./libs/dynamodb-lib";
import {getInfo} from "./solana";

export const main = handler(async (event, context) => {

  const wallet = event["queryStringParameters"]['wallet']
  const params = {
    TableName: process.env.TABLENAME,
    // 'Key' defines the partition key and sort key of the item to be retrieved
    Key: {
      walletKey: wallet,
    },
  };

  const result = await dynamoDb.get(params);

  if (!result.Item) {

    console.log("Get from blockchain, put in table, read from table and return");
    const NFTByWallet = await getInfo(wallet);
    // Put logic 
    const params1 = {
    TableName: process.env.TABLENAME,
    Item: {
      walletKey: wallet, // The id of the author
      data: NFTByWallet,
    },
    };

    await dynamoDb.put(params1);

    const newResult = await dynamoDb.get(params);

    if (!newResult.Item) {
      throw new Error("Item not found.");
    }
    return newResult.Item;
  }

  console.log("Read from table and return");
  return result.Item;

  // TODO: in the future do not get the item again
  // Return the retrieved item

});