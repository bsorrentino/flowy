import {render, html } from 'lit-html';
import type { FlowyDiagram } from 'flowy-engine'
import { numBlockLinked, isBlockAlreadyLinked, blockType } from './element-utils'

const grabme_img = new URL('../assets/grabme.svg', import.meta.url)

const CONDITION_TYPE = 'condition'
const CONDITION_TEST_TYPE = `${CONDITION_TYPE}.test`

export const  createConditionTemplates = () => 
    [
        html`
        <div class="blockelem create-flowy noselect" blockelemtype="${CONDITION_TYPE}">
            <div class="grabme">
                <img src="${grabme_img}">
            </div>
            <div class="blockin">
                <div class="blockico">
                    <span></span>
                    <img src="">
                </div>
                <div class="blocktext">
                    <p class="blocktitle">Condition</p>
                    <p class="blockdesc">This is a condition element</p>
                </div>
            </div>
        </div>`,
        html`
        <div class="blockelem create-flowy noselect" blockelemtype="${CONDITION_TEST_TYPE}">
            <div class="grabme">
                <img src="${grabme_img}">
            </div>
            <div class="blockico">
                <span></span>
                <img src="">
            </div>
            <div class="blockin">
                <div class="blocktext">
                    <p class="blocktitle">Test</p>
                    <p class="blockdesc">This is a condition test element</p>
                </div>
            </div>
        </div>`
    ]

export const addElement = ( diagram:FlowyDiagram, target:HTMLElement, parent?:HTMLElement ) => {

    if( !parent ) return false // GUARD

    switch( blockType(target) ) {
        case CONDITION_TYPE:
            return addConditionElement( diagram, target, parent )
        case CONDITION_TEST_TYPE:  
            return addConditionTestElement( diagram, target, parent )
        default:
            return false
    }
}

const addConditionTestElement = ( diagram:FlowyDiagram, target:HTMLElement, parent?: HTMLElement  ) =>  {
    if( !parent ) return false // GUARD
    if( blockType(parent) !== CONDITION_TYPE ) return false
    if( numBlockLinked( diagram, parent.id ) >= 2 ) return false // GUARD

    const content = 
        html`
        <div>
            <div class='blockyleft'>
                <img src=''>
                <p class='blockyname'>TEST</p>
            </div>
            <div class='blockyright'>
                <img src=''>
            </div>
            <div class='blockydiv'></div>
            <div class='blockyinfo'>condition branch</div>
        </div>
        `
    target.innerHTML = '' // delete children
    render( content, target )

    return true
}

const addConditionElement = (diagram:FlowyDiagram, target:HTMLElement, parent?: HTMLElement ) =>  {

    if( parent && isBlockAlreadyLinked( diagram, parent.id )) { // GUARD
        return false
    }

    const content = 
        html`
        <div>
            <div class='blockyleft'>
                <img src=''>
                    <p class='blockyname'>CONDITION</p>
            </div>
            <div class='blockyright'>
                <img src=''>
            </div>
            <div class='blockydiv'></div>
            <div class='blockyinfo'>condition element</div>
        </div>
        `

    target.innerHTML = '' // delete children
    render( content, target )

    return true
}
