import { AppRegistry } from 'react-native'
import { getCurrentCommand } from './CommandRunner'
import * as Scenarios from './scenarios/Scenarios'
import { REACT_APP_SCENARIO_NAME, REACT_APP_ENDPOINT, REACT_APP_API_KEY } from '@env'
import BugsnagPerformance from '@bugsnag/react-native-performance'

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

export const launchScenario = async (rootTag) => {
  let command

  if (REACT_APP_SCENARIO_NAME && REACT_APP_API_KEY) {
    command = { scenario_name: REACT_APP_SCENARIO_NAME, api_key: REACT_APP_API_KEY, endpoint: REACT_APP_ENDPOINT }
  } else {
    while (true) {
      delay(500)
      command = await getCurrentCommand()

      // keep polling until a scenario command is received
      if (command.action === 'run_scenario') {
        break
      }
    }
  }

  const scenario = Scenarios[command.scenario_name]

  BugsnagPerformance.start({
    apiKey: command.api_key,
    endpoint: command.endpoint,
    appName: 'com.bugsnag.reactnative.performance',
    ...scenario.config
  })

  AppRegistry.registerComponent(command.scenario_name, () => scenario.App)
  AppRegistry.runApplication(command.scenario_name, { initialProps: {}, rootTag })
}
