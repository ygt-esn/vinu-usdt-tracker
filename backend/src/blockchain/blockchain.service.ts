import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { FirebaseService } from '../firebase/firebase.service';

const ERC20_TRANSFER_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

@Injectable()
export class BlockchainService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.WebSocketProvider;
  private contract: ethers.Contract;

  constructor(
    private readonly configService: ConfigService,
    private readonly firebaseService: FirebaseService,
  ) {}

  async onModuleInit() {
    await this.startListening();
  }

  async onModuleDestroy() {
    if (this.contract) {
      await this.contract.removeAllListeners();
    }
    if (this.provider) {
      await this.provider.destroy();
    }
  }

  private async startListening() {
    const wssUrl = this.configService.get<string>('ALCHEMY_WSS_URL');
    const contractAddress = this.configService.get<string>('USDT_CONTRACT_ADDRESS');
    const minUsdtStr = this.configService.get<string>('MIN_USDT_AMOUNT', '100000');

    if (!wssUrl || !contractAddress) {
      throw new Error('ALCHEMY_WSS_URL veya USDT_CONTRACT_ADDRESS .env içinde eksik!');
    }

    // USDT decimals = 6 olduğu için BigInt bazında kesin eşik değeri hesaplanır
    const minAmountRaw = ethers.parseUnits(minUsdtStr, 6);

    this.provider = new ethers.WebSocketProvider(wssUrl);
    this.contract = new ethers.Contract(contractAddress, ERC20_TRANSFER_ABI, this.provider);

    this.logger.log(
      `Ethereum Mainnet USDT kontratı dinleniyor... Eşik: ${minUsdtStr} USDT`,
    );

    this.contract.on(
      'Transfer',
      async (
        from: string,
        to: string,
        value: bigint,
        event: ethers.ContractEventPayload,
      ) => {
        // BigInt karşılaştırması: Hassasiyet kaybı sıfır
        if (value >= minAmountRaw) {
          const formattedAmount = ethers.formatUnits(value, 6);
          const txHash = event.log.transactionHash;

          this.logger.log(
            `🐋 Yakalandı: ${formattedAmount} USDT | ${from} -> ${to} | Tx: ${txHash}`,
          );

          await this.firebaseService.sendTransferNotification({
            from,
            to,
            amount: formattedAmount,
            txHash,
          });
        }
      },
    );
  }
}