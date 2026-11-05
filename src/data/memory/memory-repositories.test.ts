import { describeRepositoriesContract } from '../repositories.contract';
import { createMemoryRepositories } from './memory-repositories';

describeRepositoriesContract('in-memory', async (clock) => createMemoryRepositories({ clock }));
