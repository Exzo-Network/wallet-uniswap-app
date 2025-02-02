import { NetInfoState } from '@react-native-community/netinfo'
import { CurrencyAmount, NativeCurrency, TradeType } from '@uniswap/sdk-core'
import { BigNumber, providers } from 'ethers'
import {
  ExactInputSwapTransactionInfo,
  ExactOutputSwapTransactionInfo,
  FinalizedTransactionStatus,
  TransactionStatus,
} from 'src/features/transactions/types'
import { v4 as uuid } from 'uuid'
import { ChainId } from 'wallet/src/constants/chains'

export function getSerializableTransactionRequest(
  request: providers.TransactionRequest,
  chainId?: ChainId
): providers.TransactionRequest {
  // prettier-ignore
  const { to, from, nonce, gasLimit, gasPrice, data, value, maxPriorityFeePerGas, maxFeePerGas, type } = request
  // Manually restructure the txParams to ensure values going into store are serializable
  return {
    chainId,
    type,
    to,
    from,
    nonce: nonce ? BigNumber.from(nonce).toString() : undefined,
    gasLimit: gasLimit?.toString(),
    gasPrice: gasPrice?.toString(),
    data: data?.toString(),
    value: value?.toString(),
    maxPriorityFeePerGas: maxPriorityFeePerGas?.toString(),
    maxFeePerGas: maxFeePerGas?.toString(),
  }
}

function getNativeCurrencyTotalSpend(
  value?: CurrencyAmount<NativeCurrency>,
  gasFee?: string,
  nativeCurrency?: NativeCurrency
): Maybe<CurrencyAmount<NativeCurrency>> {
  if (!gasFee || !nativeCurrency) return value

  const gasFeeAmount = CurrencyAmount.fromRawAmount(nativeCurrency, gasFee)
  return value ? gasFeeAmount.add(value) : gasFeeAmount
}

export function hasSufficientFundsIncludingGas(params: {
  transactionAmount?: CurrencyAmount<NativeCurrency>
  gasFee?: string
  nativeCurrencyBalance?: CurrencyAmount<NativeCurrency>
}): boolean {
  const { transactionAmount, gasFee, nativeCurrencyBalance } = params
  const totalSpend = getNativeCurrencyTotalSpend(
    transactionAmount,
    gasFee,
    nativeCurrencyBalance?.currency
  )
  return !totalSpend || !nativeCurrencyBalance?.lessThan(totalSpend)
}

export function createTransactionId(): string {
  return uuid()
}

export function getInputAmountFromTrade(
  typeInfo: ExactInputSwapTransactionInfo | ExactOutputSwapTransactionInfo
): string {
  return typeInfo.tradeType === TradeType.EXACT_INPUT
    ? typeInfo.inputCurrencyAmountRaw
    : typeInfo.expectedInputCurrencyAmountRaw
}

export function getOutputAmountFromTrade(
  typeInfo: ExactInputSwapTransactionInfo | ExactOutputSwapTransactionInfo
): string {
  return typeInfo.tradeType === TradeType.EXACT_OUTPUT
    ? typeInfo.outputCurrencyAmountRaw
    : typeInfo.expectedOutputCurrencyAmountRaw
}

export const ANIMATE_SPRING_CONFIG = {
  stiffness: 90,
  damping: 15,
  mass: 0.8,
}

export function isOffline(networkStatus: NetInfoState): boolean {
  return (
    networkStatus.type !== 'unknown' &&
    typeof networkStatus.isInternetReachable === 'boolean' &&
    networkStatus.isConnected === false
  )
}

// Based on the current status of the transaction, we determine the new status.
export function getFinalizedTransactionStatus(
  currentStatus: TransactionStatus,
  receiptStatus?: number
): FinalizedTransactionStatus {
  if (!receiptStatus) {
    return TransactionStatus.Failed
  }
  if (currentStatus === TransactionStatus.Cancelling) {
    return TransactionStatus.Cancelled
  }
  return TransactionStatus.Success
}
