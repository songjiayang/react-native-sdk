
# react-native-textile

## Getting started

`$ npm install  @textile/react-native-sdk --save`

### Mostly automatic installation

`$ react-native link @textile/react-native-sdk`

I also need to add `go-mobile` to the search paths of parent project,

```
Framework search paths: $(SRCROOT)/../node_modules/@textile/go-mobile/ios
Library search paths: $(SRCROOT)/../node_modules/@textile/go-mobile/ios
```

#### Link textilego in Android

Finally, you need to edit your `android/settings.gradle` file, simply add as the last line,

`include ':textilego'`


### Manual installation

#### iOS

1. In XCode, in the project navigator, right click `Libraries` ➜ `Add Files to [your project's name]`
2. Go to `node_modules` ➜ `@textile/react-native-sdk` and add `RNTextile.xcodeproj`
3. In XCode, in the project navigator, select your project. Add `libRNTextile.a` to your project's `Build Phases` ➜ `Link Binary With Libraries`
4. Run your project (`Cmd+R`)<

#### Android

1. Open up `android/app/src/main/java/[...]/MainActivity.java`
  - Add `import io.textile.rnmobile.RNTextilePackage;` to the imports at the top of the file
  - Add `new RNTextilePackage()` to the list returned by the `getPackages()` method
2. Append the following lines to `android/settings.gradle`:
  	```
  	include ':react-native-textile'
  	project(':react-native-textile').projectDir = new File(rootProject.projectDir, 	'../node_modules/react-native-textile/android')
  	```
3. Insert the following lines inside the dependencies block in `android/app/build.gradle`:
  	```
      compile project(':react-native-textile')
  	```


### Installing peerDependencies

Beyond `react` and `react-native` the SDK has two peerDependencies that you need to install in your code to make the SDK work properly. Be sure to follow the full installation instructions for each of these, including linking them.

1. [react-native-background-fetch](https://github.com/transistorsoft/react-native-background-fetch)
2. [react-native-background-timer](https://github.com/ocetnik/react-native-background-timer)


## React Native Boilerplate

To jump right into a working app, see our demo [IPFS boilerplate app](https://github.com/textileio/react-native-boilerplate).

## App Setup

### Stateful APIs

A few of the Textile methods require access to a single instance with stored state. This instance can be wired into your app in one single place and then communicated with over Events. The minimum requirement to wire Textile into your app are:

##### Initialize & setup & teardown the Textile class

```javascript
import Textile from '@textile/react-native-sdk';


export default class App extends Component<Props> {
  textile = Textile;

  componentDidMount() {
    this.textile.setup();
  }
  componentWillUnMount() {
    this.textile.tearDown();
  }

  render() {
    return (
      <View>
        <Text>Textile</Text>
      </View>
    )
  }
}
```

##### Create and start the node

You need to call this event from anyplace in your app in order for the node to start. 

```javascript
import Textile from '@textile/react-native-sdk';

Textile.createAndStartNode();
```

##### [Optional] -- Trigger background updates

The node is designed to gracefully disconnect and wind-down tasks when the user backgrounds the containing app. However, some apps may choose to spin the node up in the background in order to sync data or discover new updates. 

You can do this in a background fetch triggered background event

```javascript
  import Textile from '@textile/react-native-sdk';

  ...
  setup () {
    BackgroundFetch.configure({}, () => {
      Textile.backgroundFetch();
    }, (error) => {})
  }
```

Or yu can do this in a location triggered background event

```javascript
  import Textile from '@textile/react-native-sdk';

  ...
  handleNewPosition () {
    Textile.locationUpdate();
  }
```

`backgroundFetch` and `locationUpdate` are stateless APIs and can be run anywhere in your app without having to reference your initialized node. 
