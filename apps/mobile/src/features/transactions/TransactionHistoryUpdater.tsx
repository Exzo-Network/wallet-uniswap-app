// causing lint job to fail
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import dayjs from 'dayjs'
import React, { useEffect, useMemo } from 'react'
import { View } from 'react-native'
import { batch } from 'react-redux'
import { useAppDispatch, useAppSelector } from 'src/app/hooks'
import { useRefetchQueries } from 'src/data/hooks'
import {
  pushNotification,
  setLastTxNotificationUpdate,
  setNotificationStatus,
} from 'src/features/notifications/notificationSlice'
import { selectLastTxNotificationUpdate } from 'src/features/notifications/selectors'
import { buildReceiveNotification } from 'src/features/notifications/utils'
import { parseDataResponseToTransactionDetails } from 'src/features/transactions/history/utils'
import { useSelectAddressTransactions } from 'src/features/transactions/hooks'
import { TransactionStatus, TransactionType } from 'src/features/transactions/types'
import { useAccounts } from 'src/features/wallet/hooks'
import {
  makeSelectAccountHideSpamTokens,
  selectActiveAccountAddress,
} from 'src/features/wallet/selectors'
import { PollingInterval } from 'wallet/src/constants/misc'
import {
  TransactionHistoryUpdaterQueryResult,
  TransactionListQuery,
  useTransactionHistoryUpdaterQuery,
  useTransactionListLazyQuery,
} from 'wallet/src/data/__generated__/types-and-hooks'
import { ONE_SECOND_MS } from 'wallet/src/utils/time'

/**
 * For all imported accounts, checks for new transactions and updates
 * the notification status in redux.
 */
export function TransactionHistoryUpdater(): JSX.Element | null {
  const accounts = useAccounts()
  const addresses = useMemo(() => {
    return Object.keys(accounts)
  }, [accounts])

  const skip = addresses.length === 0

  const { data } = useTransactionHistoryUpdaterQuery({
    variables: { addresses },
    pollInterval: PollingInterval.Fast,
    fetchPolicy: 'network-only', // Ensure latest data.
    skip,
  })

  if (skip || !data?.portfolios?.length) {
    return null
  }

  return (
    <>
      {data.portfolios.map((portfolio) => {
        if (!portfolio?.ownerAddress || !portfolio?.assetActivities) return null

        return (
          <View
            key={portfolio.ownerAddress}
            testID={`AddressTransactionHistoryUpdater/${portfolio.ownerAddress}`}>
            <AddressTransactionHistoryUpdater
              activities={portfolio.assetActivities}
              address={portfolio.ownerAddress}
            />
          </View>
        )
      })}
    </>
  )
}

function AddressTransactionHistoryUpdater({
  address,
  activities,
}: {
  address: string
  activities: NonNullable<
    NonNullable<
      NonNullable<NonNullable<TransactionHistoryUpdaterQueryResult['data']>['portfolios']>[0]
    >['assetActivities']
  >
}): JSX.Element | null {
  const dispatch = useAppDispatch()

  const activeAccountAddress = useAppSelector(selectActiveAccountAddress)

  // Current txn count for all addresses
  const lastTxNotificationUpdateTimestamp = useAppSelector(selectLastTxNotificationUpdate)[address]

  const fetchAndDispatchReceiveNotification = useFetchAndDispatchReceiveNotification()

  // dont show notifications on spam tokens if setting enabled
  const hideSpamTokens = useAppSelector<boolean>(makeSelectAccountHideSpamTokens(address))

  const localTransactions = useSelectAddressTransactions(address)

  const refetchQueries = useRefetchQueries()

  useEffect(() => {
    batch(async () => {
      let newTransactionsFound = false

      // Parse txns and address from portfolio.
      activities.map((activity) => {
        if (!activity) return

        if (!lastTxNotificationUpdateTimestamp) {
          dispatch(setLastTxNotificationUpdate({ address, timestamp: dayjs().valueOf() })) // Note this is in ms
          return
        }

        const updatedTimestampMs = activity.timestamp * ONE_SECOND_MS // convert api response from s -> ms
        const hasNewTxn = updatedTimestampMs > lastTxNotificationUpdateTimestamp

        if (hasNewTxn) {
          dispatch(setLastTxNotificationUpdate({ address, timestamp: updatedTimestampMs }))

          // Dont flag notification status for txns submitted from app, this is handled in transactionWatcherSaga.
          const confirmedLocally = localTransactions?.some(
            // eslint-disable-next-line max-nested-callbacks
            (localTx) => localTx.hash === activity.transaction.hash
          )
          if (!confirmedLocally) {
            dispatch(setNotificationStatus({ address, hasNotifications: true }))
          }

          // full send refetch all active (mounted) queries
          newTransactionsFound = true
        }
      })

      if (newTransactionsFound) {
        // Fetch full recent txn history and dispatch receive notification if needed.
        if (address === activeAccountAddress) {
          await fetchAndDispatchReceiveNotification(
            address,
            lastTxNotificationUpdateTimestamp,
            hideSpamTokens
          )
        }

        // Delay 1s to ensure NXYZ balances sync after we detect this new txn. (As balances pulled
        // from different data source)
        setTimeout(
          // NOTE: every wallet may call this on new transaction.
          // It may be better to batch this action, or target specific queries.
          refetchQueries,
          ONE_SECOND_MS
        )
      }
    })
  }, [
    activeAccountAddress,
    activities,
    address,
    dispatch,
    fetchAndDispatchReceiveNotification,
    hideSpamTokens,
    lastTxNotificationUpdateTimestamp,
    localTransactions,
    refetchQueries,
  ])

  return null
}

/*
 * Fetch and search recent transactions for receive txn. If confirmed since the last status update timestamp,
 * dispatch notification update. We specical case here because receive is never initiated within app.
 *
 * Note: we opt for a waterfall request here because full transaction data is a large query that we dont
 * want to submit every polling interval - only fetch this data if new txn is detected. This ideally gets
 * replaced with a subcription to new transactions with more full txn data.
 */
export function useFetchAndDispatchReceiveNotification(): (
  address: string,
  lastTxNotificationUpdateTimestamp: number | undefined,
  hideSpamTokens: boolean
) => Promise<void> {
  const [fetchFullTransactionData] = useTransactionListLazyQuery()
  const dispatch = useAppDispatch()

  return async (
    address: string,
    lastTxNotificationUpdateTimestamp: number | undefined,
    hideSpamTokens = false
  ): Promise<void> => {
    // Fetch full transaction history for user address.
    const { data: fullTransactionData } = await fetchFullTransactionData({
      variables: { address },
      fetchPolicy: 'network-only', // Ensure latest data.
    })

    const notification = getReceiveNotificationFromData(
      fullTransactionData,
      address,
      lastTxNotificationUpdateTimestamp,
      hideSpamTokens
    )

    if (notification) {
      dispatch(pushNotification(notification))
    }
  }
}

export function getReceiveNotificationFromData(
  data: TransactionListQuery | undefined,
  address: Address,
  lastTxNotificationUpdateTimestamp: number | undefined,
  hideSpamTokens = false
) {
  if (!data || !lastTxNotificationUpdateTimestamp) return

  const parsedTxHistory = parseDataResponseToTransactionDetails(data, hideSpamTokens)

  const latestReceivedTx = parsedTxHistory
    .sort((a, b) => a.addedTime - b.addedTime)
    .find(
      (tx) =>
        tx.addedTime &&
        tx.addedTime >= lastTxNotificationUpdateTimestamp &&
        tx.typeInfo.type === TransactionType.Receive &&
        tx.status === TransactionStatus.Success
    )

  if (!latestReceivedTx) return

  return buildReceiveNotification(latestReceivedTx, address)
}
