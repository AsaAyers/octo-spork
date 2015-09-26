import DataLoader from 'dataloader'
import isPlainObject from 'lodash.isplainobject'

const loaders = {}
const META = Symbol()

// These are just exported for testing.
export const notPromise = 'not a promise'
export const notArray = "Promise didn't resolve to an array"
export const notActions = "not actions"
export const writeFail = "write fail"

export const loaderMiddleware = store => next => action => {
    if (typeof action[META] === 'undefined') {
        return next(action)
    }
    const { args, loaderKey } = action[META]
    let { dataLoader } = loaders[loaderKey]
    const { selector, loader } = loaders[loaderKey]

    const hasData = (...args) => selector(...args)(store.getState()) != null

    if (!dataLoader) {
        loaders[loaderKey].dataLoader = dataLoader = new DataLoader(keys => {
            const toFetch = keys.filter((key) => !hasData(key))

            let loaderResult

            if (toFetch.length > 0) {
                loaderResult = loader(toFetch)

                if (typeof loaderResult.then !== 'function') {
                    return Promise.reject(new Error(notPromise))
                }
            } else {
                loaderResult = Promise.resolve([])
            }

            return loaderResult.then((actions) => {
                if (!actions || !actions.forEach) {
                    throw new Error(notArray)
                }

                actions.forEach((action, index) => {
                    if (!isPlainObject(action) || typeof action.type === 'undefined') {
                        throw new Error(notActions)
                    }

                    store.dispatch(action)

                    const key = toFetch[index]
                    if (!hasData(key)) {
                        throw new Error(writeFail)
                    }


                })

                return keys.map((key) => selector(key)(store.getState()) )
            })
        })
    }

    return dataLoader.load(args).catch((err) => {
        console.warn(err) // eslint-disable-line no-console
        throw err
    })
}

export function wrapSelector(selector, loader) {
    const LOADER_KEY = Symbol('unique loader')
    loaders[LOADER_KEY] = {
        selector,
        loader,
        dataLoader: null,
    }

    return (...args) => {
        return {
            [META]: {
                loaderKey: LOADER_KEY,
                args,
            }
        }
    }
}
