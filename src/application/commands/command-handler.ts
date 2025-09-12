import { Command } from './command';

export interface CommandHandler<T extends Command> {
  handle(command: T): Promise<void>;
}

export abstract class CommandHandlerBase<T extends Command> implements CommandHandler<T> {
  abstract handle(command: T): Promise<void>;
}