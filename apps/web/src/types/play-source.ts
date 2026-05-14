export interface PlaySourceQualityDTO {
  id: string;
  label: string;
  url: string;
}

export interface PlaySourceDTO {
  id: string;
  name: string;
  roomId: string;
  order: number;
  qualities: PlaySourceQualityDTO[];
}
