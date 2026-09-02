import { Body, Container, Head, Html, Tailwind, Text } from "@react-email/components"
import { formatPHP } from "@/lib/format"

interface OverdraftWarningEmailProps {
  attemptedExpense: number
  category: string
  shortfall: number
}

export function OverdraftWarningEmail({ attemptedExpense, category, shortfall }: OverdraftWarningEmailProps) {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-zinc-950 font-sans text-zinc-300">
          <Container className="mx-auto max-w-md rounded-lg border border-red-500/50 bg-red-500/10 p-6">
            <Text className="text-lg font-medium text-red-500">Overdraft Warning</Text>
            <Text>
              Attempted {category} expense of {formatPHP(attemptedExpense)} exceeds available funds.
            </Text>
            <Text className="font-medium text-red-500">Shortfall: {formatPHP(shortfall)}</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
