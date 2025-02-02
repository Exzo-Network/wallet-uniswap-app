import React, { memo } from 'react'
import OverlayIcon from 'src/components/icons/OverlayIcon'
import { Box } from 'src/components/layout'
import { theme } from 'src/styles/theme'
import NoTransactionFgIcon from 'ui/src/assets/icons/empty-state-coin.svg'
import NoTransactionBgIcon from 'ui/src/assets/icons/empty-state-transaction.svg'

export const NoTransactions = memo(() => (
  <Box mb="spacing24">
    <OverlayIcon
      bottom={-23}
      icon={<NoTransactionBgIcon color={theme.colors.textSecondary} />}
      left={5}
      overlay={
        <NoTransactionFgIcon color={theme.colors.background3} fill={theme.colors.accentAction} />
      }
    />
  </Box>
))
