import { CompleteNavigation, ReactNativeNavigationPlugin } from '@bugsnag/react-native-navigation-performance'
import React, { useEffect, useState } from 'react'
import { SafeAreaView, Text } from 'react-native'
import { Navigation } from 'react-native-navigation'

export const config = {
    maximumBatchSize: 3,
    appVersion: '1.2.3',
    plugins: [new ReactNativeNavigationPlugin(Navigation)]
}

export function registerScreens() {
    Navigation.registerComponent('Screen 1', () => Screen1);
    Navigation.registerComponent('Screen 2', () => Screen2);

    Navigation.setRoot({
        root: {
            stack: {
                children: [
                    {
                        component: {
                            name: 'Screen 1'
                        }
                    }
                ]
            }
        }
    })
}

function Screen1(props) {
    useEffect(() => {
        setTimeout(() => {
            Navigation.push(props.componentId, {
                component: {
                    name: 'Screen 2'
                }
            })
        }, 250)
    }, [])

    return (
        <SafeAreaView>
            <Text>Screen 1</Text>
        </SafeAreaView>
    )
}

function Screen2(props) {
    const [loaded, setLoaded] = useState(false)

    useEffect(() => {
        setTimeout(() => {
            setLoaded(true)
        }, 50)
    }, [])

    return (
        <SafeAreaView>
            <Text>Screen 2</Text>
            <CompleteNavigation on={loaded} />
        </SafeAreaView>
    )
}