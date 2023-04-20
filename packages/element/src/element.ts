import {html, render} from 'lit-html';
import { unsafeHTML } from 'lit-html/directives/unsafe-html';
import type { FlowyDiagram } from 'flowy-engine'
import './element.css'

import * as condition from './condition'

const mode_img = new URL('../assets/more.svg', import.meta.url)
const grabme_img = new URL('../assets/grabme.svg', import.meta.url)
const logred_img = new URL('../assets/logred.svg', import.meta.url)
const databaseorange_img = new URL('../assets/databaseorange.svg', import.meta.url)
const eye_img = new URL('../assets/eye.svg', import.meta.url)
const eyeblue_img = new URL('../assets/eyeblue.svg', import.meta.url)
const action_img = new URL('../assets/action.svg', import.meta.url)
const actionblue_img = new URL('../assets/actionblue.svg', import.meta.url)
const actionorange_img = new URL('../assets/actionorange.svg', import.meta.url)
const time_img = new URL('../assets/time.svg', import.meta.url)
const timeblue_img = new URL('../assets/timeblue.svg', import.meta.url)
const error_img = new URL('../assets/error.svg', import.meta.url)
const errorblue_img = new URL('../assets/errorblue.svg', import.meta.url)
const errorred_img = new URL('../assets/errorred.svg', import.meta.url)
const database_img = new URL('../assets/database.svg', import.meta.url)
const twitter_img = new URL('../assets/twitter.svg', import.meta.url)
const twitterorange_img = new URL('../assets/twitterorange.svg', import.meta.url)
const log_img = new URL('../assets/log.svg', import.meta.url)
const close_img = new URL('../assets/close.svg', import.meta.url)
const dropdown_img = new URL('../assets/dropdown.svg', import.meta.url)
const checkon_img = new URL('../assets/checkon.svg', import.meta.url)
const checkoff_img = new URL('../assets/checkoff.svg', import.meta.url)

function isBlockAlreadyLinked( diagram:FlowyDiagram, id:string|number  ) {

    let blockId:string =  ( typeof(id) == 'number' ) ?  `block${id}` : id

    // const selector = `div[parent='${blockId}']`
    const selector = `.arrowblock[source='${blockId}']`
    const e = diagram.querySelector( selector )

    if( e ) {
        console.debug( `reject link to element (${blockId})` )
        return true
    }

    return false

}

export function initElement( diagram:FlowyDiagram, templates_container:HTMLElement, properties_container:HTMLElement ) {

    diagram.addEventListener( 'templateGrabbed', (e) =>  {
        e.detail.classList.add('blockdisabled')
    }, false )
    
    diagram.addEventListener( 'templateReleased', (e) => { 
        e.detail.classList.remove("blockdisabled") 
    }, false)

    diagram.addEventListener( 'sheetClosed', (e) =>  {
        e.detail.classList.remove('selectedblock')

        properties_container.querySelector("#properties")?.classList.remove("expanded")
    }, true )

    diagram.addEventListener( 'blockSelected', e => {
        // GUARD
        if( diagram.querySelector( ".selectedblock" ) !== null ) return 

        e.detail.classList.add( 'selectedblock')

        _addPropertiesSheet( diagram, properties_container, e.detail  )

        properties_container.querySelector("#properties")?.classList.add("expanded")

    }, false )

    diagram.addEventListener( 'snapping', e => {

        const { target, parent } = e.detail

        if( parent && isBlockAlreadyLinked( diagram, parent.id )) {
            e.preventDefault()
            return
        }

        addElement( diagram, target, parent  ) 

    }, false )

    diagram.addEventListener( 'moving', e => {

        const { target:id } = e.detail

        if( isBlockAlreadyLinked( diagram, id ) ) {
            e.preventDefault()
        }

    }, false )

    _addTemplates( templates_container )


}


const addElement = ( diagram:FlowyDiagram, target:HTMLElement, parent?:HTMLElement ) => {

    const value = (target.querySelector(".blockelemtype") as HTMLDataElement).value

    switch( value ) {
        case "1":
            _addElement( diagram, target, eyeblue_img, 'New visitor', 'When a <span>new visitor</span> goes to <span>Site 1</span>')
            break
        case "2" :
            _addElement( diagram, target, actionblue_img, 'Action is performed', 'When <span>Action 1</span> is performed')
            break
        case "3":
            _addElement( diagram, target, timeblue_img, 'Time has passed', 'When <span>10 seconds</span> have passed</div>')
            break
        case "4":
            _addElement( diagram, target, errorblue_img, 'Error prompt', 'When <span>Error 1</span> is triggered</div>')
            break
        case "5":
            _addElement( diagram, target, databaseorange_img, 'New database entry', 'Add <span>Data object</span> to <span>Database 1</span>');
            break
        case "6":
            _addElement( diagram, target, databaseorange_img, 'Update database', 'Update <span>Database 1</span>');
            break
        case "7":
            _addElement( diagram, target, actionorange_img, 'Perform an action', 'Perform <span>Action 1</span>');
            break
        case "8":
            _addElement( diagram, target, twitterorange_img, 'Make a tweet', 'Tweet <span>Query 1</span> with the account <span>@alyssaxuu</span>');
            break
        case "9":
            _addElement( diagram, target, logred_img, 'Add new log entry', 'Add new <span>success</span> log entry');
            break
        case "10":
            _addElement( diagram, target, logred_img, 'Update logs', 'Edit <span>Log Entry 1</span>');
            break
        case "11":
            _addElement( diagram, target, errorred_img, 'Prompt an error', 'Trigger <span>Error 1</span>');
            break
        case condition.TYPE:
            return condition.addElement( diagram, target, parent  )  
        default:
            return false
    }

    return true;
}

const _addElement = ( diagram:FlowyDiagram, target:HTMLElement, image_url:URL, title:string, description:string ) =>  {
    
    const content = 
        html`
        <div>
            <div class='blockyleft'>
                <img src='${image_url}'>
                    <p class='blockyname'>${title}</p>
            </div>
            <div class='blockyright'>
                <img src='${mode_img}'>
            </div>
            <div class='blockydiv'></div>
            <div class='blockyinfo'>${unsafeHTML(description)}</div>
        </div>
        `

    return render( content, target )
}

const  _createTemplate = ( value:number, image_url:URL, title:string, description:string ) => 
    html`
    <div class="blockelem create-flowy noselect">
        <input type="hidden" name="blockelemtype" class="blockelemtype" value="${value}">
        <div class="grabme">
            <img src="${grabme_img}">
        </div>
        <div class="blockin">
            <div class="blockico">
                <span></span>
                <img src="${image_url}">
            </div>
            <div class="blocktext">
                <p class="blocktitle">${title}</p>
                <p class="blockdesc">${unsafeHTML(description)}</p>
            </div>
        </div>
    </div>    
    `

const _addTemplates =  ( target:HTMLElement ) => {

    const templates = [
            _createTemplate( 1, eye_img, 'New visitor', 'Triggers when somebody visits a specified page'),
            _createTemplate( 2, action_img, 'Action is performed', 'Triggers when somebody performs a specified action'),
            _createTemplate( 3, time_img, 'Time has passed', 'Triggers after a specified amount of time'),
            _createTemplate( 4, error_img, 'Error prompt', 'Triggers when a specified error happens'),
    
            _createTemplate(5, database_img, 'New database entry', 'Adds a new entry to a specified database'),
            _createTemplate(6, database_img, 'Update database', 'Edits and deletes database entries and properties'),
            _createTemplate(7, action_img, 'Perform an action', 'Performs or edits a specified action'),
            _createTemplate(8, twitter_img, 'Make a tweet', 'Makes a tweet with a specified query'),

            _createTemplate(9, log_img, 'Add new log entry', 'Adds a new log entry to this project'),
            _createTemplate(10, log_img, 'Update logs', 'Edits and deletes log entries in this project'),
            _createTemplate(11, error_img, 'Prompt an error', 'Triggers a specified error'),
            condition.createTemplate(),
    ]

    render(html`${templates}`, target)
        
} 

const _addPropertiesSheet = ( diagram:FlowyDiagram, target:HTMLElement, element:HTMLElement ) => {

    const closed = (e:UIEvent) => {

        const event = new CustomEvent<HTMLElement>('sheetClosed', {
            detail: element
        })
        diagram.dispatchEvent(event)

    }
    const content =  html`
    <div id="properties">
        <div id="close" @click="${closed}">
            <img src="${close_img}">
        </div>
        <p id="header2">Properties</p>
        <div id="propswitch">
            <div id="dataprop">Data</div>
            <div id="alertprop">Alerts</div>
            <div id="logsprop">Logs</div>
        </div>
        <div id="proplist">
            <p class="inputlabel">Select database</p>
            <div class="dropme">Database 1 <img src="${dropdown_img}"></div>
            <p class="inputlabel">Check properties</p>
            <div class="dropme">All<img src="${dropdown_img}"></div>
            <div class="checkus"><img src="${checkon_img}"><p>Log on successful performance</p></div>
            <div class="checkus"><img src="${checkoff_img}"><p>Give priority to this block</p></div>
        </div>
        <div id="divisionthing"></div>
        <div id="removeblock" @click="${() => diagram.deleteBlocks()}">Delete blocks</div>
    </div>
    `
    render( content, target )

}

// @customElement('flowy-myelement')
// export class FlowyElement extends LitElement {

//     @property()
//     type: 'element' | 'template' | 'propertysheet' = 'element'

//     @property( { type: 'number' })
//     value?:number

//     @property()
//     image_url?: URL

//     @property()
//     title: string = ''

//     @property()
//     description: string = ''

//     constructor() {
//         super();
//     }

//     /**
//      * disable shadow root
//      * 
//      * @returns 
//      * @see [How to create LitElement without Shadow DOM?](https://stackoverflow.com/a/55213037/521197)
//      */
//     createRenderRoot() {
//         return this;
//     }

//     protected render() {

//         const { type , value, image_url, title, description } = this    
        
//         if( type == 'element') {
//             return html`
//             <div>
//                 <div class='blockyleft'>
//                     <img src='${image_url}'>
//                         <p class='blockyname'>${title}</p>
//                 </div>
//                 <div class='blockyright'>
//                     <img src='${mode_img}'>
//                 </div>
//                 <div class='blockydiv'></div>
//                 <div class='blockyinfo'>${unsafeHTML(description)}</div>
//             </div>
//             `
    
//         }
//         if( type == 'template' ) {
//             return html`
//             <div>
//                 <input type="hidden" name="blockelemtype" class="blockelemtype" value="${value}">
//                 <div class="grabme">
//                     <img src="${grabme_img}">
//                 </div>

//                 <div class="blockin">
//                     <div class="blockico">
//                         <span></span>
//                         <img src="${image_url}">
//                     </div>
//                     <div class="blocktext">
//                         <p class="blocktitle">${title}</p>
//                         <p class="blockdesc">${unsafeHTML(description)}</p>
//                     </div>
//                 </div>
//             </div>
//             `
//         }

//         if( type == 'propertysheet') {

//             return html`
//                 <div id="properties">
//                     <div id="close">
//                         <img src="${image_url}">
//                     </div>
//                     <p id="header2">Properties</p>
//                     <div id="propswitch">
//                         <div id="dataprop">Data</div>
//                         <div id="alertprop">Alerts</div>
//                         <div id="logsprop">Logs</div>
//                     </div>
//                     <div id="proplist">
//                         <p class="inputlabel">Select database</p>
//                         <div class="dropme">Database 1 <img src="assets/dropdown.svg"></div>
//                         <p class="inputlabel">Check properties</p>
//                         <div class="dropme">All<img src="assets/dropdown.svg"></div>
//                         <div class="checkus"><img src="assets/checkon.svg"><p>Log on successful performance</p></div>
//                         <div class="checkus"><img src="assets/checkoff.svg"><p>Give priority to this block</p></div>
//                     </div>
//                     <div id="divisionthing"></div>
//                     <div id="removeblock">Delete blocks</div>
//                 </div>
//             `
//         }
//     }

// }