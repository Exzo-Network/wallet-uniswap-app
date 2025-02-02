import { Action } from '@reduxjs/toolkit'
import { BigintIsh, Currency, CurrencyAmount, TradeType } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import { i18n } from 'src/app/i18n'
import { AssetType } from 'src/entities/assets'
import { SpotPrice } from 'src/features/dataApi/spotPricesQuery'
import { GQLNftAsset } from 'src/features/nfts/hooks'
import { pushNotification } from 'src/features/notifications/notificationSlice'
import {
  AppNotificationType,
  ReceiveCurrencyTxNotification,
  ReceiveNFTNotification,
  WalletConnectNotification,
} from 'src/features/notifications/types'
import {
  NFTTradeType,
  TransactionDetails,
  TransactionStatus,
  TransactionType,
} from 'src/features/transactions/types'
import { WalletConnectEvent } from 'src/features/walletConnect/saga'
import { CHAIN_INFO } from 'wallet/src/constants/chains'
import { logger } from 'wallet/src/features/logger/logger'
import { getValidAddress, shortenAddress } from 'wallet/src/utils/addresses'
import { currencyIdToAddress } from 'wallet/src/utils/currencyId'
import { formatCurrencyAmount, formatUSDPrice, NumberType } from 'wallet/src/utils/format'

export const formWCNotificationTitle = (appNotification: WalletConnectNotification): string => {
  const { event, dappName, chainId } = appNotification

  switch (event) {
    case WalletConnectEvent.Connected:
      return i18n.t('Connected')
    case WalletConnectEvent.Disconnected:
      return i18n.t('Disconnected')
    case WalletConnectEvent.NetworkChanged:
      if (chainId) {
        return i18n.t('Switched to {{networkName}}', {
          networkName: CHAIN_INFO[chainId]?.label,
        })
      }
      return i18n.t('Switched networks')
    case WalletConnectEvent.TransactionConfirmed:
      return i18n.t('Transaction confirmed with {{dappName}}', { dappName })
    case WalletConnectEvent.TransactionFailed:
      return i18n.t('Transaction failed with {{dappName}}', { dappName })
  }
}

export const formApproveNotificationTitle = (
  txStatus: TransactionStatus,
  currency: Maybe<Currency>,
  tokenAddress: Address,
  spender: Address
): string => {
  const currencySymbol = getCurrencySymbol(currency, tokenAddress)
  const address = shortenAddress(spender)
  return txStatus === TransactionStatus.Success
    ? i18n.t('Approved {{currencySymbol}} for use with {{address}}.', {
        currencySymbol,
        address,
      })
    : txStatus === TransactionStatus.Cancelled
    ? i18n.t('Canceled {{currencySymbol}} approve.', {
        currencySymbol,
        address,
      })
    : i18n.t('Failed to approve {{currencySymbol}} for use with {{address}}.', {
        currencySymbol,
        address,
      })
}

export const formSwapNotificationTitle = (
  txStatus: TransactionStatus,
  tradeType: TradeType,
  inputCurrency: Maybe<Currency>,
  outputCurrency: Maybe<Currency>,
  inputCurrencyId: string,
  outputCurrencyId: string,
  inputCurrencyAmountRaw: string,
  outputCurrencyAmountRaw: string
): string => {
  const inputCurrencySymbol = getCurrencySymbol(inputCurrency, currencyIdToAddress(inputCurrencyId))
  const outputCurrencySymbol = getCurrencySymbol(
    outputCurrency,
    currencyIdToAddress(outputCurrencyId)
  )

  const inputAmount = getFormattedCurrencyAmount(
    inputCurrency,
    inputCurrencyAmountRaw,
    tradeType === TradeType.EXACT_OUTPUT
  )
  const outputAmount = getFormattedCurrencyAmount(
    outputCurrency,
    outputCurrencyAmountRaw,
    tradeType === TradeType.EXACT_INPUT
  )

  const inputAssetInfo = `${inputAmount}${inputCurrencySymbol}`
  const outputAssetInfo = `${outputAmount}${outputCurrencySymbol}`

  return txStatus === TransactionStatus.Success
    ? i18n.t('Swapped {{inputAssetInfo}} for {{outputAssetInfo}}.', {
        inputAssetInfo,
        outputAssetInfo,
      })
    : txStatus === TransactionStatus.Cancelled
    ? i18n.t('Canceled {{inputCurrencySymbol}}-{{outputCurrencySymbol}} swap.', {
        inputCurrencySymbol,
        outputCurrencySymbol,
      })
    : i18n.t('Failed to swap {{inputAssetInfo}} for {{outputAssetInfo}}.', {
        inputAssetInfo,
        outputAssetInfo,
      })
}

export const formWrapNotificationTitle = (
  txStatus: TransactionStatus,
  inputCurrency: Maybe<Currency>,
  outputCurrency: Maybe<Currency>,
  currencyAmountRaw: string,
  unwrapped: boolean
): string => {
  const inputCurrencySymbol = inputCurrency?.symbol
  const outputCurrencySymbol = outputCurrency?.symbol

  const inputAmount = getFormattedCurrencyAmount(inputCurrency, currencyAmountRaw)
  const outputAmount = getFormattedCurrencyAmount(outputCurrency, currencyAmountRaw)

  const inputAssetInfo = `${inputAmount}${inputCurrencySymbol}`
  const outputAssetInfo = `${outputAmount}${outputCurrencySymbol}`

  if (unwrapped) {
    return txStatus === TransactionStatus.Success
      ? i18n.t('Unwrapped {{inputAssetInfo}} and received {{outputAssetInfo}}.', {
          inputAssetInfo,
          outputAssetInfo,
        })
      : txStatus === TransactionStatus.Cancelled
      ? i18n.t('Canceled {{inputCurrencySymbol}} unwrap.', {
          inputCurrencySymbol,
        })
      : i18n.t('Failed to unwrap {{inputAssetInfo}}.', {
          inputAssetInfo,
        })
  }
  return txStatus === TransactionStatus.Success
    ? i18n.t('Wrapped {{inputAssetInfo}} and received {{outputAssetInfo}}.', {
        inputAssetInfo,
        outputAssetInfo,
      })
    : txStatus === TransactionStatus.Cancelled
    ? i18n.t('Canceled {{inputCurrencySymbol}} wrap.', {
        inputCurrencySymbol,
      })
    : i18n.t('Failed to wrap {{inputAssetInfo}}.', {
        inputAssetInfo,
      })
}

export const formTransferCurrencyNotificationTitle = (
  txType: TransactionType,
  txStatus: TransactionStatus,
  currency: Maybe<Currency>,
  tokenAddress: string,
  currencyAmountRaw: string,
  senderOrRecipient: string
): string => {
  const currencySymbol = getCurrencySymbol(currency, tokenAddress)
  const amount = getFormattedCurrencyAmount(currency, currencyAmountRaw)
  const shortenedAddressOrENS = getShortenedAddressOrEns(senderOrRecipient)
  return formTransferTxTitle(txType, txStatus, `${amount}${currencySymbol}`, shortenedAddressOrENS)
}

export const formTransferNFTNotificationTitle = (
  txType: TransactionType,
  txStatus: TransactionStatus,
  nft: GQLNftAsset | undefined,
  tokenAddress: Address,
  tokenId: string,
  senderOrRecipient: string
): string => {
  const nftName = nft?.name ?? `NFT ${shortenAddress(tokenAddress)} #${tokenId}`
  const shortenedAddressOrENS = getShortenedAddressOrEns(senderOrRecipient)
  return formTransferTxTitle(txType, txStatus, nftName, shortenedAddressOrENS)
}

export const formUnknownTxTitle = (
  txStatus: TransactionStatus,
  tokenAddress: Address | undefined,
  ensName: string | null
): string => {
  let addressText
  if (ensName) {
    addressText = i18n.t(' with {{ensName}}', { ensName })
  } else if (tokenAddress) {
    const address = shortenAddress(tokenAddress)
    addressText = i18n.t(' with {{address}}', { address })
  } else {
    addressText = ''
  }

  return txStatus === TransactionStatus.Success
    ? i18n.t('Transacted{{addressText}}.', { addressText })
    : i18n.t('Failed to transact{{addressText}}.', { addressText })
}

const formTransferTxTitle = (
  txType: TransactionType,
  txStatus: TransactionStatus,
  assetInfo: string,
  senderOrRecipient: string
): string => {
  if (txType === TransactionType.Send) {
    return txStatus === TransactionStatus.Success
      ? i18n.t('Sent {{assetInfo}} to {{senderOrRecipient}}.', { assetInfo, senderOrRecipient })
      : txStatus === TransactionStatus.Cancelled
      ? i18n.t('Canceled {{assetInfo}} send.', { assetInfo, senderOrRecipient })
      : i18n.t('Failed to send {{assetInfo}} to {{senderOrRecipient}}.', {
          assetInfo,
          senderOrRecipient,
        })
  }

  return i18n.t('Received {{assetInfo}} from {{senderOrRecipient}}.', {
    assetInfo,
    senderOrRecipient,
  })
}

export interface BalanceUpdate {
  assetValueChange: string
  usdValueChange: string | undefined
}

interface BalanceUpdateProps {
  transactionType: TransactionType
  transactionStatus: TransactionStatus
  currency: Maybe<Currency>
  currencyAmountRaw: string
  spotPrice?: SpotPrice
  nftTradeType?: NFTTradeType
  transactedUSDValue?: string | number | undefined // optional if USD amount already known
}

interface NFTTradeBalanceUpdateProps extends BalanceUpdateProps {
  transactionType: TransactionType.NFTTrade
  nftTradeType: NFTTradeType
}

export const createBalanceUpdate = ({
  transactionType,
  transactionStatus,
  currency,
  currencyAmountRaw,
  spotPrice,
  nftTradeType,
  transactedUSDValue,
}: BalanceUpdateProps | NFTTradeBalanceUpdateProps): BalanceUpdate | undefined => {
  if (
    !currency ||
    !(
      transactionStatus === TransactionStatus.Success ||
      transactionStatus === TransactionStatus.Pending ||
      transactionStatus === TransactionStatus.FailedCancel
    )
  ) {
    return undefined
  }
  const currencyAmount = getFormattedCurrencyAmount(currency, currencyAmountRaw)
  const isDecrease =
    transactionType === TransactionType.Send ||
    transactionType === TransactionType.NFTMint ||
    (transactionType === TransactionType.NFTTrade && nftTradeType === NFTTradeType.BUY)
  return {
    assetValueChange: `${isDecrease ? '-' : '+'}${currencyAmount}${currency.symbol}`,
    usdValueChange: transactedUSDValue
      ? formatUSDPrice(transactedUSDValue)
      : getUSDValue(spotPrice, currencyAmountRaw, currency),
  }
}

export function convertScientificNotationToNumber(value: string): string | JSBI {
  let convertedValue: string | BigintIsh = value

  // Convert scientific notation into number format so it can be parsed by BigInt properly
  if (value.includes('e')) {
    const [xStr, eStr] = value.split('e')
    let x = Number(xStr)
    let e = Number(eStr)
    if (xStr?.includes('.')) {
      const splitX = xStr.split('.')
      const decimalPlaces = splitX[1]?.split('').length ?? 0
      e -= decimalPlaces
      x *= Math.pow(10, decimalPlaces)
    }
    try {
      convertedValue = JSBI.multiply(
        JSBI.BigInt(x),
        JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(e))
      )
    } catch (error) {
      // If the numbers can't be converted to BigInts then just do regular arithmetic (i.e. when the exponent is negative)
      logger.debug(
        'notifications/utils',
        'convertScientificNotationToNumber',
        'BigInt arithmetic unsuccessful',
        e
      )
      convertedValue = (x * Math.pow(10, e)).toString()
    }
  }

  return convertedValue
}

export const getFormattedCurrencyAmount = (
  currency: Maybe<Currency>,
  currencyAmountRaw: string,
  isApproximateAmount = false
): string => {
  if (!currency) return ''

  try {
    // Convert scientific notation into number format so it can be parsed by BigInt properly
    const parsedCurrencyAmountRaw: string | BigintIsh =
      convertScientificNotationToNumber(currencyAmountRaw)

    const currencyAmount = CurrencyAmount.fromRawAmount<Currency>(currency, parsedCurrencyAmountRaw)
    const formattedAmount = formatCurrencyAmount(currencyAmount, NumberType.TokenTx)
    return isApproximateAmount ? `~${formattedAmount} ` : `${formattedAmount} `
  } catch (e) {
    logger.error('notifications/utils', 'getFormattedCurrencyAmount', 'could not format amount', e)
    return ''
  }
}

const getUSDValue = (
  spotPrice: SpotPrice | undefined,
  currencyAmountRaw: string,
  currency: Maybe<Currency>
): string | undefined => {
  const price = spotPrice?.price?.value
  if (!currency || !price) return undefined

  const usdValue = (Number(currencyAmountRaw) / 10 ** currency.decimals) * price
  return formatUSDPrice(usdValue)
}

export const getCurrencySymbol = (
  currency: Maybe<Currency>,
  tokenAddressString: Address | undefined
): string | undefined => {
  return currency?.symbol
    ? currency.symbol
    : tokenAddressString && getValidAddress(tokenAddressString, true)
    ? shortenAddress(tokenAddressString)
    : tokenAddressString
}

const getShortenedAddressOrEns = (addressOrENS: string): string => {
  return getValidAddress(addressOrENS) ? shortenAddress(addressOrENS) : addressOrENS
}

/**
 * Based on noticiation type info, returns an AppNotification object for either NFT or Currency receive.
 * Must be a 'Receive' type transaction.
 *
 * Returns undefined if not all data is found for either Currency or NFT case, or if transaction is not
 * the correct type.
 */
export function buildReceiveNotification(
  transactionDetails: TransactionDetails,
  receivingAddress: Address // not included in transactionDetails
): ReceiveNFTNotification | ReceiveCurrencyTxNotification | undefined {
  const { typeInfo, status, chainId, hash, id } = transactionDetails

  // Only build notification object on succesful receive transactions.
  if (status !== TransactionStatus.Success || typeInfo.type !== TransactionType.Receive) {
    return undefined
  }

  const baseNotificationData = {
    txStatus: status,
    chainId,
    txHash: hash,
    address: receivingAddress,
    txId: id,
  }

  // Currency receive txn.
  if (
    typeInfo?.assetType === AssetType.Currency &&
    typeInfo?.currencyAmountRaw &&
    typeInfo?.sender
  ) {
    return {
      ...baseNotificationData,
      type: AppNotificationType.Transaction,
      txType: TransactionType.Receive,
      assetType: typeInfo.assetType,
      tokenAddress: typeInfo.tokenAddress,
      currencyAmountRaw: typeInfo.currencyAmountRaw,
      sender: typeInfo.sender,
    }
  }

  // NFT receive txn.
  if (
    (typeInfo?.assetType === AssetType.ERC1155 || typeInfo?.assetType === AssetType.ERC721) &&
    typeInfo?.tokenId
  ) {
    return {
      ...baseNotificationData,
      type: AppNotificationType.Transaction,
      txType: TransactionType.Receive,
      assetType: typeInfo.assetType,
      tokenAddress: typeInfo.tokenAddress,
      tokenId: typeInfo.tokenId,
      sender: typeInfo.sender,
    }
  }

  return undefined
}

export function getNotificationErrorAction(errorMessage: string): Action {
  return pushNotification({
    type: AppNotificationType.Error,
    errorMessage,
  })
}
