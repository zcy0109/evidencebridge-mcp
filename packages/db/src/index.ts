import { PrismaClient } from "@prisma/client";

const globalDatabase = globalThis as unknown as { evidencebridgePrisma?: PrismaClient };

export const prisma = globalDatabase.evidencebridgePrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalDatabase.evidencebridgePrisma = prisma;

export async function persistConversationTurn(input: {
  workspaceId: string;
  conversationId?: string;
  title: string;
  userContent: string;
  assistantContent: string;
}) {
  if (input.conversationId) {
    await prisma.message.createMany({
      data: [
        { conversationId: input.conversationId, role: "user", content: input.userContent },
        { conversationId: input.conversationId, role: "assistant", content: input.assistantContent },
      ],
    });
    return input.conversationId;
  }
  const conversation = await prisma.conversation.create({
    data: {
      workspaceId: input.workspaceId,
      title: input.title,
      messages: {
        create: [
          { role: "user", content: input.userContent },
          { role: "assistant", content: input.assistantContent },
        ],
      },
    },
    select: { id: true },
  });
  return conversation.id;
}
