import { Token } from '@uniswap/sdk-core'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { flowToModalName, TokenSelectorFlow } from 'src/components/TokenSelector/TokenSelector'
import { useTokenProjects } from 'src/features/dataApi/tokenProjects'
import { sendAnalyticsEvent } from 'src/features/telemetry'
import { MobileEventName } from 'src/features/telemetry/constants'
import { MATIC_MAINNET_ADDRESS } from 'wallet/src/constants/addresses'
import { ChainId } from 'wallet/src/constants/chains'
import { DAI, USDC, USDT, WBTC, WRAPPED_NATIVE_CURRENCY } from 'wallet/src/constants/tokens'
import { CurrencyInfo, GqlResult } from 'wallet/src/features/dataApi/types'
import { usePersistedError } from 'wallet/src/features/dataApi/utils'
import { NativeCurrency } from 'wallet/src/features/tokens/NativeCurrency'
import { areAddressesEqual } from 'wallet/src/utils/addresses'
import { currencyId } from 'wallet/src/utils/currencyId'

// Use Mainnet base token addresses since TokenProjects query returns each token on Arbitrum, Optimism, Polygon
const baseCurrencies = [
  NativeCurrency.onChain(ChainId.Mainnet),
  NativeCurrency.onChain(ChainId.Polygon), // Used for MATIC base currency on Polygon
  DAI,
  USDC,
  USDT,
  WBTC,
  WRAPPED_NATIVE_CURRENCY[ChainId.Mainnet],
]

export const baseCurrencyIds = baseCurrencies.map(currencyId)

export function useAllCommonBaseCurrencies(): GqlResult<CurrencyInfo[]> {
  const { data: baseCurrencyInfos, loading, error, refetch } = useTokenProjects(baseCurrencyIds)
  const persistedError = usePersistedError(loading, error)

  // TokenProjects returns MATIC on Mainnet and Polygon, but we only want MATIC on Polygon
  const filteredBaseCurrencyInfos = useMemo(() => {
    return baseCurrencyInfos?.filter(
      (currencyInfo) =>
        !areAddressesEqual((currencyInfo.currency as Token).address, MATIC_MAINNET_ADDRESS)
    )
  }, [baseCurrencyInfos])

  return { data: filteredBaseCurrencyInfos, loading, error: persistedError, refetch }
}

export function useFilterCallbacks(
  chainId: ChainId | null,
  flow: TokenSelectorFlow
): {
  chainFilter: ChainId | null
  searchFilter: string | null
  onChangeChainFilter: (newChainFilter: ChainId | null) => void
  onClearSearchFilter: () => void
  onChangeText: (newSearchFilter: string) => void
} {
  const [chainFilter, setChainFilter] = useState<ChainId | null>(chainId)
  const [searchFilter, setSearchFilter] = useState<string | null>(null)

  useEffect(() => {
    setChainFilter(chainId)
  }, [chainId])

  const onChangeChainFilter = useCallback(
    (newChainFilter: typeof chainFilter) => {
      setChainFilter(newChainFilter)
      sendAnalyticsEvent(MobileEventName.NetworkFilterSelected, {
        chain: newChainFilter ?? 'All',
        modal: flowToModalName(flow),
      })
    },
    [flow]
  )

  const onClearSearchFilter = useCallback(() => {
    setSearchFilter(null)
  }, [])

  const onChangeText = useCallback(
    (newSearchFilter: string) => setSearchFilter(newSearchFilter),
    [setSearchFilter]
  )

  return {
    chainFilter,
    searchFilter,
    onChangeChainFilter,
    onClearSearchFilter,
    onChangeText,
  }
}
