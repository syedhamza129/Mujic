export type RootStackParamList = {
  Tabs: undefined;
  Login: undefined;
  Register: undefined;
  Player: undefined;
  Queue: undefined;
  PlaylistDetail: { id: string };
  SongDetail: { id: string };
  LikedSongs: undefined;
  History: undefined;
  Upload: undefined;
  Genres: { genre?: string } | undefined;
};

export type TabParamList = {
  Home: undefined;
  Search: undefined;
  Library: undefined;
  Profile: undefined;
};
