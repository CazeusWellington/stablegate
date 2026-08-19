import { initSimulationWorker } from './simulationQueue'
import { initRaceCreationScheduler } from './raceScheduler'

export function initWorkers() {
  initSimulationWorker()
  initRaceCreationScheduler()
  console.log('Workers initialized')
}
