import { useState } from 'react';
import PropTypes from 'prop-types';

// Mock chat data
const mockChats = [
  {
    id: 1,
    name: 'Jane Doe',
    lastMessage: 'Sounds good! See you then.',
    time: '10:30 PM',
    unread: true,
    avatarUrl: 'https://ui-avatars.com/api/?name=User&background=4A4A4A&color=fff&size=150',
  },
  {
    id: 2,
    name: 'John Smith',
    lastMessage: 'Can you send me the file?',
    time: 'Yesterday',
    unread: false,
    avatarUrl: 'https://ui-avatars.com/api/?name=User&background=4A4A4A&color=fff&size=150',
  },
  {
    id: 3,
    name: 'Project Group',
    lastMessage: 'Meeting at 3 PM tomorrow',
    time: 'Yesterday',
    unread: false,
    avatarUrl: 'https://ui-avatars.com/api/?name=User&background=4A4A4A&color=fff&size=150',
  },
  {
    id: 4,
    name: 'Sarah Williams',
    lastMessage: 'Thanks for your help!',
    time: '2 days ago',
    unread: false,
    avatarUrl: 'https://ui-avatars.com/api/?name=User&background=4A4A4A&color=fff&size=150',
  },
  {
    id: 5,
    name: 'Mike Johnson',
    lastMessage: 'Let me know when you&apos;re free',
    time: '3 days ago',
    unread: false,
    avatarUrl: 'https://ui-avatars.com/api/?name=User&background=4A4A4A&color=fff&size=150',
  },
];

const ChatListPage = ({ onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter chats based on search query
  const filteredChats = mockChats.filter((chat) => {
    const query = searchQuery.toLowerCase();
    return (
      chat.name.toLowerCase().includes(query) ||
      chat.lastMessage.toLowerCase().includes(query)
    );
  });

  // Handle chat item click
  const handleChatClick = (chatId) => {
    if (onNavigate) {
      onNavigate('chat', { chatId });
    }
  };

  return (
    <div
      className="relative flex h-auto min-h-screen w-full flex-col font-display group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark text-white"
      style={{ fontFamily: '"Plus Jakarta Sans", "Noto Sans", sans-serif' }}
    >
      {/* Radial gradient background effect */}
      <div className="absolute top-0 left-0 w-full h-[400px] bg-[radial-gradient(ellipse_40%_50%_at_50%_0%,_rgba(164,19,236,0.3),_rgba(0,0,0,0))] pointer-events-none -z-1 opacity-70"></div>

      <main className="flex-1">
        {/* Top Bar - Profile Picture */}
        <div className="flex items-center bg-transparent p-4 pb-2 justify-between sticky top-0 z-10 backdrop-blur-sm">
          <div className="flex size-12 shrink-0 items-center justify-start">
            <div
              className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10"
              style={{ backgroundImage: 'url("https://ui-avatars.com/api/?name=User&background=4A4A4A&color=fff&size=150' }}
            ></div>
          </div>
          <div className="flex-1"></div>
          <div className="flex w-12 items-center justify-end"></div>
        </div>

        {/* Search Bar */}
        <div className="px-4 py-3 bg-transparent sticky top-[72px] z-10 backdrop-blur-md">
          <label className="flex flex-col min-w-40 h-12 w-full">
            <div className="flex w-full flex-1 items-stretch rounded-full h-full">
              <div className="text-text-secondary-dark flex border-none bg-surface-dark items-center justify-center pl-4 rounded-l-full border-r-0">
                <span className="material-symbols-outlined text-2xl">search</span>
              </div>
              <input
                className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-r-full text-white focus:outline-0 focus:ring-0 border-none bg-surface-dark focus:border-none h-full placeholder:text-text-secondary-dark px-4 pl-2 text-base font-normal leading-normal"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </label>
        </div>

        {/* Chats Header */}
        <div className="flex flex-col px-4 pt-4">
          <h2 className="text-white text-2xl font-bold leading-tight tracking-tight">
            Chats
          </h2>
        </div>

        {/* Chat List */}
        <div className="flex flex-col">
          {filteredChats.map((chat) => (
            <div
              key={chat.id}
              className="flex flex-col group hover:bg-white/5 active:bg-white/10 transition-colors duration-200 cursor-pointer"
              onClick={() => handleChatClick(chat.id)}
            >
              <div className="flex items-center gap-4 px-4 min-h-[72px] py-3 justify-between">
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="relative shrink-0">
                    <div
                      className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-14"
                      style={{ backgroundImage: `url("${chat.avatarUrl}")` }}
                    ></div>
                  </div>
                  <div className="flex flex-col justify-center overflow-hidden">
                    <p className="text-white text-base font-bold leading-normal truncate">
                      {chat.name}
                    </p>
                    <p
                      className={`text-sm font-${
                        chat.unread ? 'bold' : 'normal'
                      } leading-normal truncate ${
                        chat.unread ? 'text-white' : 'text-text-secondary-dark'
                      }`}
                    >
                      {chat.lastMessage}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0 gap-1.5">
                  <p className="text-text-secondary-dark text-sm font-normal leading-normal">
                    {chat.time}
                  </p>
                  {chat.unread && <div className="size-3 rounded-full bg-primary"></div>}
                </div>
              </div>
              <div className="h-px w-full bg-surface-dark ml-22"></div>
            </div>
          ))}

          {/* No results message */}
          {filteredChats.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <p className="text-text-secondary-dark text-base">
                No chats found matching &quot;{searchQuery}&quot;
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

ChatListPage.propTypes = {
  onNavigate: PropTypes.func,
};

export default ChatListPage;
