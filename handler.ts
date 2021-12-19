import { APIGatewayProxyHandler } from "aws-lambda";
import { PublicKey, Connection,clusterApiUrl } from '@solana/web3.js';
import { AccountLayout,MintLayout, AccountInfo as TokenAccountInfo,u64 } from '@solana/spl-token';
import {getMetadata} from './helpers/accounts';
import { decodeMetadata, Metadata } from './helpers/schema';

type StringPublicKey = string;

const deserializeAccount = (data: Buffer) => {
  const accountInfo = AccountLayout.decode(data);
  accountInfo.mint = new PublicKey(accountInfo.mint);
  accountInfo.owner = new PublicKey(accountInfo.owner);
  accountInfo.amount = u64.fromBuffer(accountInfo.amount);

  if (accountInfo.delegateOption === 0) {
    accountInfo.delegate = null;
    accountInfo.delegatedAmount = new u64(0);
  } else {
    accountInfo.delegate = new PublicKey(accountInfo.delegate);
    accountInfo.delegatedAmount = u64.fromBuffer(accountInfo.delegatedAmount);
  }

  accountInfo.isInitialized = accountInfo.state !== 0;
  accountInfo.isFrozen = accountInfo.state === 2;

  if (accountInfo.isNativeOption === 1) {
    accountInfo.rentExemptReserve = u64.fromBuffer(accountInfo.isNative);
    accountInfo.isNative = true;
  } else {
    accountInfo.rentExemptReserve = null;
    accountInfo.isNative = false;
  }

  if (accountInfo.closeAuthorityOption === 0) {
    accountInfo.closeAuthority = null;
  } else {
    accountInfo.closeAuthority = new PublicKey(accountInfo.closeAuthority);
  }

  return accountInfo;
};


interface TokenAccount {
  pubkey: string;
  account: AccountInfo<Buffer>;
  info: TokenAccountInfo;
}

type AccountInfo<T> = {
  /** `true` if this account's data contains a loaded program */
  executable: boolean;
  /** Identifier of the program that owns the account */
  owner: PublicKey;
  /** Number of lamports assigned to the account */
  lamports: number;
  /** Optional data assigned to the account */
  data: T;
};

const TokenAccountParser = (
  pubKey: StringPublicKey,
  info: AccountInfo<Buffer>,
) => {
  // Sometimes a wrapped sol account gets closed, goes to 0 length,
  // triggers an update over wss which triggers this guy to get called
  // since your UI already logged that pubkey as a token account. Check for length.
  if (info.data.length > 0) {
    const buffer = Buffer.from(info.data);
    const data = deserializeAccount(buffer);

    const details = {
      pubkey: pubKey,
      account: {
        ...info,
      },
      info: data,
    } as TokenAccount;

    return details;
  }
};

async function getInfo(wallet: string) {

  const connection = new Connection(clusterApiUrl('devnet'));
  const pubkey=new PublicKey(wallet);
  const accounts = await connection.getTokenAccountsByOwner(pubkey, {
    programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
  });

  const arr=[]

  accounts.value.forEach(info => {
    arr.push(TokenAccountParser(
      info.pubkey.toBase58(),
      info.account,
    ));
  });

  const items = arr.filter( (word) => {
    return word.info.amount.toNumber()==1
  })

  const arr_meta=[]

  for (let i = 0; i < items.length; i++) {
    const mint = await connection.getAccountInfo(
      items[i].info.mint,
    );
    const buffer = Buffer.from(mint.data);
    const mintInfo = MintLayout.decode(buffer);
    
    if(mintInfo.decimals==0){
      const metadata= await getMetadata(items[i].info.mint)
      const metadataObj = await connection.getAccountInfo(metadata);
      if(metadataObj){
        const metadataDecoded: Metadata = decodeMetadata(
          Buffer.from(metadataObj.data),
        );
        arr_meta.push(metadataDecoded);
      }
    }
  }

  return arr_meta;

}

export const hello: APIGatewayProxyHandler = async (event, context, callback) => {
  //console.log("hi",event);
  const wallet = event["queryStringParameters"]['wallet']
  const accounts = await getInfo(wallet);
  return { 
    statusCode: 200,
    body: JSON.stringify(accounts,null,2),
  };
};
