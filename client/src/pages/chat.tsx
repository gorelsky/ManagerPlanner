import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import BottomNavigation from "@/components/bottom-navigation";
import SideMenu from "@/components/side-menu";
import UserProfile from "@/components/user-profile";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { supabase } from "@/supabase";
import type { InsertMessage } from "@shared/schema";

type MessageWithDetails = {
  id: string;
  senderId: string;
  receiverId: string | null;
  content: string;
  createdAt: string;
  readAt: string | null;
  sender?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    middleName?: string | null;
    role?: string | null;
    profileImage?: string | null;
    username?: string | null;
  };
};

async function getMessages(userId: string): Promise<MessageWithDetails[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(
      `
      id,
      sender_id,
      receiver_id,
      content,
      created_at,
      read_at,
      sender:users!messages_sender_id_fkey (
        id,
        first_name,
        last_name,
        middle_name,
        role,
        profile_image,
        username
      )
    `,
    )
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Не удалось загрузить сообщения");
  }

  return (data ?? []).map((m: any) => ({
    id: m.id,
    senderId: m.sender_id,
    receiverId: m.receiver_id,
    content: m.content,
    createdAt: m.created_at,
    readAt: m.read_at ?? null,
    sender: m.sender
      ? {
          id: m.sender.id,
          firstName: m.sender.first_name,
          lastName: m.sender.last_name,
          middleName: m.sender.middle_name,
          role: m.sender.role,
          profileImage: m.sender.profile_image,
          username: m.sender.username,
        }
      : undefined,
  }));
}

async function createMessage(message: InsertMessage) {
  const { error } = await supabase.from("messages").insert({
    sender_id: message.senderId,
    receiver_id: message.receiverId,
    content: message.content,
  });

  if (error) {
    throw new Error("Не удалось отправить сообщение");
  }
}

export default function Chat() {
  const [messageText, setMessageText] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading, error } = useQuery({
    queryKey: ["supabase/messages", user?.id],
    queryFn: () => getMessages(user!.id),
    enabled: !!user?.id,
  });

  const sendMessageMutation = useMutation({
    mutationFn: createMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supabase/messages", user?.id] });
      setMessageText("");
      toast({
        title: "Сообщение отправлено",
        description: "Ваше сообщение успешно отправлено",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось отправить сообщение",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!messageText.trim() || !user) return;

    const message: InsertMessage = {
      senderId: user.id,
      receiverId: null,
      content: messageText.trim(),
    };

    sendMessageMutation.mutate(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`messages-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["supabase/messages", user?.id] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка чата...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Ошибка загрузки чата</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center pb-16">
      <div className="w-full max-w-sm bg-card flex flex-col h-[calc(98vh-5rem)]">
        <div className="border-b border-border bg-blue-header text-white">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-3">
              <SideMenu />
              <div>
                <h1 className="text-xl font-semibold">Чат</h1>
                <p className="text-sm text-white/70">Общение с командой</p>
              </div>
            </div>
          </div>

          {user && <UserProfile user={user as any} />}
        </div>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 py-4">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">Пока нет сообщений</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Отправьте первое сообщение
                </p>
              </div>
            ) : (
              messages.map((message) => {
                const isOwnMessage = message.senderId === user.id;
                const senderFirst = message.sender?.firstName || "";
                const senderLast = message.sender?.lastName || "";
                const initials = `${senderFirst?.[0] || ""}${senderLast?.[0] || ""}` || "U";

                return (
                  <div
                    key={message.id}
                    className={`flex ${
                      isOwnMessage ? "justify-end" : "justify-start"
                    } gap-2`}
                  >
                    {!isOwnMessage && (
                      <Avatar className="w-8 h-8 mt-1">
                        {message.sender?.profileImage && (
                          <AvatarImage src={message.sender.profileImage} />
                        )}
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>
                    )}

                    <div className={`max-w-[80%] ${isOwnMessage ? "order-1" : ""}`}>
                      {!isOwnMessage && (
                        <div className="text-xs text-muted-foreground mb-1">
                          {senderFirst} {senderLast}
                          {message.sender?.role === "admin" && (
                            <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                              Админ
                            </span>
                          )}
                        </div>
                      )}

                      <div
                        className={`rounded-lg px-3 py-2 ${
                          isOwnMessage
                            ? "bg-blue-600 text-white"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        <p
                          className={`text-xs mt-1 ${
                            isOwnMessage ? "text-blue-300" : "text-muted-foreground"
                          }`}
                        >
                          {format(new Date(message.createdAt), "dd.MM.yyyy HH:mm", {
                            locale: ru,
                          })}
                        </p>
                      </div>
                    </div>

                    {isOwnMessage && (
                      <Avatar className="w-8 h-8 mt-1">
                        {user.profileImage && <AvatarImage src={user.profileImage} />}
                        <AvatarFallback className="text-xs">
                          {user.firstName?.[0] || ""}
                          {user.lastName?.[0] || ""}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border bg-card">
          <div className="flex items-end space-x-2">
            <div className="flex-1">
              <Input
                placeholder="Напишите сообщение..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleKeyPress}
                className="resize-none"
              />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!messageText.trim() || sendMessageMutation.isPending}
              size="icon"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
}