import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import {
  NFTMintTransactionInfo,
  TransactionDetails,
  TransactionStatus,
  TransactionType,
} from 'src/features/transactions/types'
import NFTMintSummaryItem from './NFTMintSummaryItem'

const meta: Meta<typeof NFTMintSummaryItem> = {
  title: 'WIP/Activity Items',
}

export default meta

const baseNFTMintTx: Omit<TransactionDetails, 'status'> & { typeInfo: NFTMintTransactionInfo } = {
  from: '',
  addedTime: Date.now() - 30000,
  hash: '',
  options: { request: {} },
  chainId: 1,
  id: '',
  typeInfo: {
    type: TransactionType.NFTMint,
    nftSummaryInfo: {
      collectionName: 'Froggy Friends Official',
      imageURL:
        'https://lh3.googleusercontent.com/9LokgAuB0Xqkio273GE0pY0WSJwOExFtFI1SkJT2jK-USvqFc-5if7ZP5PQ1h8s5YPimyJG5cSOdGGR2UaD3gTYMKAhj6yikYaw=s250',
      name: 'Froggy Friend #1777',
      tokenId: '1777',
    },
  },
}

export const NFTMint: StoryObj = {
  render: () => (
    <>
      <NFTMintSummaryItem
        transaction={{
          ...baseNFTMintTx,
          status: TransactionStatus.Pending,
        }}
      />
      <NFTMintSummaryItem
        transaction={{
          ...baseNFTMintTx,
          status: TransactionStatus.Cancelling,
        }}
      />
      <NFTMintSummaryItem
        transaction={{
          ...baseNFTMintTx,
          status: TransactionStatus.Cancelled,
        }}
      />
      <NFTMintSummaryItem
        transaction={{
          ...baseNFTMintTx,
          status: TransactionStatus.Failed,
        }}
      />
      <NFTMintSummaryItem
        transaction={{
          ...baseNFTMintTx,
          status: TransactionStatus.Success,
        }}
      />
    </>
  ),
}
