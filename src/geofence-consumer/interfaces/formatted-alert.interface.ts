export interface FormattedAlert {
  text: string;
  parseMode: 'HTML';
  inlineKeyboard: Array<Array<{ text: string; callback_data: string }>>;
}
