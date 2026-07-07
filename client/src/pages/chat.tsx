import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import BottomNavigation from "@/components/bottom-navigation";
import SideMenu from "@/components/side-menu";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { MessageWithDetails, InsertMessage } from "@shared/schema";

const messageApi = {
  getMessages: (userId: string) =>
    fetch(`/api/messages/${userId}`).then((res) => {
      if (!res.ok) {
        throw new Error("Не удалось загрузить сообщения");
      }
      return res.json();
    }),

  createMessage: (message: InsertMessage) =>
    fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    }).then((res) => {
      if (!res.ok) {
        throw new Error("Не удалось отправить сообщение");
      }
      return res.json();
    }),

  markAsRead: (messageId: string) =>
    fetch(`/api/messages/${messageId}/read`, {
      method: "PATCH",
    }).then((res) => {
      if (!res.ok) {
        throw new Error("Не удалось отметить сообщение прочитанным");
      }
    }),
};

export default function Chat() {
  const [messageText, setMessageText] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["/api/messages", user?.id],
    queryFn: () => messageApi.getMessages(user!.id),
    enabled: !!user?.id,
  });

  const sendMessageMutation = useMutation({
    mutationFn: messageApi.createMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", user?.id] });
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
      receiverId: null, // общий чат
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-sm mx-auto bg-card min-h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-blue-header text-white">
          <div className="flex items-center space-x-3">
            <SideMenu />
            <div>
              <h1 className="text-xl font-semibold">Чат</h1>
              <p className="text-sm text-white/70">Общение с командой</p>
            </div>
          </div>
        </div>

        {/* Messages */}
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
              messages.map((message: MessageWithDetails) => {
                const isOwnMessage = message.senderId === user.id;
                const initials = `${message.sender.firstName[0]}${message.sender.lastName[0]}`;

                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} gap-2`}
                  >
                    {!isOwnMessage && (
                      <Avatar className="w-8 h-8 mt-1">
                        {message.sender.profileImage && (
                          <AvatarImage src={message.sender.profileImage} />
                        )}
                        <AvatarFallback className="text-xs">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    )}

                    <div className={`max-w-[80%] ${isOwnMessage ? "order-1" : ""}`}>
                      {!isOwnMessage && (
                        <div className="text-xs text-muted-foreground mb-1">
                          {message.sender.firstName} {message.sender.lastName}
                          {message.sender.role === "admin" && (
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
                        <p className="text-sm whitespace-pre-wrap">
                          {message.content}
                        </p>
                        <p
                          className={`text-xs mt-1 ${
                            isOwnMessage ? "text-blue-100" : "text-muted-foreground"
                          }`}
                        >
                          {message.createdAt
                            ? format(
                                new Date(message.createdAt),
                                "HH:mm",
                                { locale: ru },
                              )
                            : ""}
                        </p>
                      </div>
                    </div>

                    {isOwnMessage && (
                      <Avatar className="w-8 h-8 mt-1">
                        {user.profileImage && (
                          <AvatarImage src={user.profileImage} />
                        )}
                        <AvatarFallback className="text-xs">
                          {user.firstName[0]}
                          {user.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="p-4 border-t border-border bg-card/95 backdrop-blur">
          <div className="flex items-end space-x-2">
            <div className="flex-1">
              <Input
                placeholder="Напишите сообщение..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={handleKeyPress}
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