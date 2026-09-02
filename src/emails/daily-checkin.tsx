import { Body, Container, Head, Html, Tailwind, Text } from "@react-email/components"
import { formatPHP } from "@/lib/format"

interface DailyCheckinEmailProps {
  todayIncome: number
  todayExpense: number
}

export function DailyCheckinEmail({ todayIncome, todayExpense }: DailyCheckinEmailProps) {
  const hasActivity = todayIncome > 0 || todayExpense > 0

  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-zinc-950 font-sans text-zinc-300">
          <Container className="mx-auto max-w-md rounded-lg border border-zinc-800 p-6">
            <Text className="text-lg font-medium text-emerald-400">Hi Adrian! 👋</Text>
            <Text>
              Have you earned or made any expenses today? Care to put something in the savings?
            </Text>
            <Text className="text-sm text-zinc-500">
              {hasActivity
                ? `So far today: Income ${formatPHP(todayIncome)} · Expenses ${formatPHP(todayExpense)}`
                : "Nothing logged yet today."}
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
