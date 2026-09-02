import { Body, Container, Head, Html, Tailwind, Text } from "@react-email/components"
import { formatPHP } from "@/lib/format"

interface WeeklyDigestEmailProps {
  totalIncome: number
  totalExpenses: number
  netCashFlow: number
}

export function WeeklyDigestEmail({ totalIncome, totalExpenses, netCashFlow }: WeeklyDigestEmailProps) {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-zinc-950 font-sans text-zinc-300">
          <Container className="mx-auto max-w-md rounded-lg border border-zinc-800 p-6">
            <Text className="text-lg font-medium text-zinc-100">Weekly Digest</Text>
            <Text>Income: {formatPHP(totalIncome)}</Text>
            <Text>Expenses: {formatPHP(totalExpenses)}</Text>
            <Text className={netCashFlow < 0 ? "text-red-500" : "text-emerald-500"}>
              Net Cash Flow: {formatPHP(netCashFlow)}
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
